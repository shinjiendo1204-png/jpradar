/**
 * Shared scraper functions — imported directly (no internal HTTP calls).
 */

export interface SurugayaProduct {
  id: string;
  title_ja: string;
  price_jpy: number;
  url: string;
  image_url: string;
  condition: string;
  category: string;
  source: 'surugaya';
  scraped_at: string;
}

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
  let m: RegExpExecArray | null;

  const linkRegex = /href="(\/product\/detail\/(\d+)[^"]*)"[^>]*>/gi;
  const links: Array<{ path: string; id: string }> = [];
  while ((m = linkRegex.exec(html)) !== null) {
    if (!links.find(l => l.id === m![2])) links.push({ path: m[1], id: m[2] });
    if (links.length >= 20) break;
  }

  const priceRegex = /[¥￥]([\d,]+)|(\d[\d,]+)\s*円/g;
  const prices: number[] = [];
  while ((m = priceRegex.exec(html)) !== null) {
    const val = parsePrice(m[1] || m[2]);
    if (val >= 100 && val <= 500000) prices.push(val);
  }

  const titleRegex = /<(?:h3|h2|p)\s+class="[^"]*(?:title|item_title|product_title)[^"]*"[^>]*>\s*([^<]{3,80})\s*<\/(?:h3|h2|p)>/gi;
  const titles: string[] = [];
  while ((m = titleRegex.exec(html)) !== null) titles.push(decodeHtml(m[1].trim()));
  if (titles.length === 0) {
    const altRegex = /alt="([^"]{3,60})"/gi;
    while ((m = altRegex.exec(html)) !== null) {
      if (!m[1].includes('http') && !m[1].includes('logo')) titles.push(decodeHtml(m[1]));
      if (titles.length >= 15) break;
    }
  }

  const imgRegex = /src="(https?:\/\/[^"]+(?:suruga-ya|surugaya)[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  const images: string[] = [];
  while ((m = imgRegex.exec(html)) !== null) {
    if (!images.includes(m[1])) images.push(m[1]);
    if (images.length >= 15) break;
  }

  const isUsed = html.includes('中古');
  const count = Math.min(links.length, prices.length, 10);
  for (let i = 0; i < count; i++) {
    if (prices[i] > 0) {
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

export async function scrapeSurugaya(keyword: string): Promise<SurugayaProduct[]> {
  const url = `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(keyword)}&rankBy=new`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Surugaya HTTP ${res.status}`);
  const html = await res.text();
  return extractProducts(html, keyword);
}

export async function getEbaySoldPrice(query: string): Promise<number> {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=40`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) return 0;
  const html = await res.text();

  const prices: number[] = [];
  const p1 = /class="s-item__price"[^>]*>\s*(?:US\s*)?\$\s*([\d,]+\.?\d*)/gi;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0.5 && val < 50000) prices.push(val);
  }
  if (prices.length === 0) return 0;
  prices.sort((a, b) => a - b);
  return prices[Math.floor(prices.length / 2)]; // median
}

export async function getExchangeRate(): Promise<number> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/JPY');
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    return data.rates?.USD || 0.0067;
  } catch {
    return 0.0067;
  }
}

export async function translateToEnglish(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return text;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Translate Japanese product names to English for eBay search. Keep brand names, model numbers. Be concise. Output only the translation.' },
          { role: 'user', content: text },
        ],
        max_tokens: 80,
        temperature: 0,
      }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}
