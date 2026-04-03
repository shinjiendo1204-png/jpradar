import { NextRequest, NextResponse } from 'next/server';
import type { SurugayaProduct } from '@/lib/types';

/**
 * Surugaya scraper.
 * robots.txt: User-agent: * Allow: / (Crawl-delay: 30)
 * We respect this with 30-min caching and cron-only access.
 */

const scrapeCache = new Map<string, { data: SurugayaProduct[]; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function parsePrice(text: string): number {
  const match = text.replace(/[,，\s]/g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function extractProducts(html: string, keyword: string): SurugayaProduct[] {
  const products: SurugayaProduct[] = [];

  // Product detail links: /product/detail/NNNNNN
  const linkRegex = /href="(\/product\/detail\/(\d+)[^"]*)"[^>]*>/gi;
  const links: Array<{ path: string; id: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    if (!links.find(l => l.id === m![2])) {
      links.push({ path: m[1], id: m[2] });
    }
    if (links.length >= 20) break;
  }

  // Prices: ¥1,980 or 1,980円
  const priceRegex = /[¥￥]([\d,]+)|(\d[\d,]+)\s*円/g;
  const prices: number[] = [];
  while ((m = priceRegex.exec(html)) !== null) {
    const val = parsePrice(m[1] || m[2]);
    if (val >= 100 && val <= 500000) prices.push(val);
  }

  // Titles
  const titleRegex = /<(?:h3|h2|p)\s+class="[^"]*(?:title|item_title|product_title)[^"]*"[^>]*>\s*([^<]{3,80})\s*<\/(?:h3|h2|p)>/gi;
  const titles: string[] = [];
  while ((m = titleRegex.exec(html)) !== null) {
    titles.push(decodeHtml(m[1].trim()));
  }
  if (titles.length === 0) {
    const altRegex = /alt="([^"]{3,60})"/gi;
    while ((m = altRegex.exec(html)) !== null) {
      if (!m[1].includes('http') && !m[1].includes('logo')) titles.push(decodeHtml(m[1]));
      if (titles.length >= 15) break;
    }
  }

  // Images
  const imgRegex = /src="(https?:\/\/[^"]+(?:suruga-ya|surugaya)[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  const images: string[] = [];
  while ((m = imgRegex.exec(html)) !== null) {
    if (!images.includes(m[1])) images.push(m[1]);
    if (images.length >= 15) break;
  }

  const isUsed = html.includes('中古');
  const count = Math.min(links.length, prices.length, 10);

  for (let i = 0; i < count; i++) {
    if (prices[i] && prices[i] > 0) {
      products.push({
        id: `surugaya-${links[i].id}`,
        title_ja: titles[i] || `商品ID:${links[i].id}`,
        price_jpy: prices[i],
        url: `https://www.suruga-ya.jp${links[i].path}`,
        image_url: images[i] || '',
        condition: isUsed ? '中古' : '新品',
        category: keyword,
        source: 'surugaya',
        scraped_at: new Date().toISOString(),
      });
    }
  }

  return products;
}

async function scrapeSurugaya(keyword: string): Promise<SurugayaProduct[]> {
  const url = `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(keyword)}&rankBy=new`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; jpradar/1.0; price-research-bot)',
      'Accept-Language': 'ja,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`Surugaya fetch failed: ${res.status}`);
  const html = await res.text();
  return extractProducts(html, keyword);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keyword = req.nextUrl.searchParams.get('keyword') || 'レトロゲーム';
  const cached = scrapeCache.get(keyword);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ products: cached.data, cached: true, keyword });
  }

  try {
    const products = await scrapeSurugaya(keyword);
    scrapeCache.set(keyword, { data: products, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ products, cached: false, keyword });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
