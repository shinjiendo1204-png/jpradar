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

  // Surugaya actual HTML structure (confirmed via debug):
  // <div class="item_detail">
  //   <div class="title"><a href="/product/detail/NNNNNN...">TITLE</a></div>
  //   ...price elements...
  // Split by item_detail blocks
  const blocks = html.split('<div class="item_detail">');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Product link and ID
    const linkMatch = block.match(/href="(\/product\/detail\/(\d+)[^"]*?)"/);
    if (!linkMatch) continue;
    const path = linkMatch[1];
    const id = linkMatch[2];

    // Title from <h3 class="product-name">TITLE</h3>
    const titleMatch = block.match(/<h3[^>]*class="product-name"[^>]*>\s*([^<]+?)\s*<\/h3>/);
    const title = titleMatch ? decodeHtml(titleMatch[1].trim()) : `商品ID:${id}`;

    // Skip sold-out items
    if (block.includes('品切れ') || block.includes('soldout')) continue;

    // Price is in <div class="item_price"> section
    // Remove teika (定価) and strike (crossed-out) prices, then find actual price
    const cleanBlock = block
      .replace(/class="price_teika">[\s\S]*?<\/p>/g, '')
      .replace(/class="strike">[^<]*<\/[^>]+>/g, '');
    const priceMatch = cleanBlock.match(/[¥￥](\d[\d,]*)/);
    if (!priceMatch) continue;
    const price = parsePrice(priceMatch[1]);
    if (price < 100 || price > 200000) continue;

    // Image
    const imgMatch = block.match(/src="(https?:\/\/www\.suruga-ya\.jp[^"]+\.(?:jpg|jpeg|png|webp)[^"]*?)"/);
    const imageUrl = imgMatch ? imgMatch[1] : '';

    // Condition
    const condition = block.includes('中古') ? '中古' : block.includes('新品') ? '新品' : '不明';

    products.push({
      id: `surugaya-${id}`,
      title_ja: title,
      price_jpy: price,
      url: `https://www.suruga-ya.jp${path}`,
      image_url: imageUrl,
      condition,
      category: keyword,
      source: 'surugaya',
      scraped_at: new Date().toISOString(),
    });

    if (products.length >= 10) break;
  }

  return products;
}

async function fetchHtml(targetUrl: string, usePremium = false, countryCode = 'jp'): Promise<string> {
  const sbKey = process.env.SCRAPINGBEE_KEY;
  if (sbKey) {
    const params = new URLSearchParams({
      api_key: sbKey,
      url: targetUrl,
      render_js: 'false',
      premium_proxy: usePremium ? 'true' : 'false',
      country_code: countryCode,
    });
    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
    if (!res.ok) throw new Error(`Scrapingbee HTTP ${res.status}`);
    return res.text();
  }
  // Fallback: direct fetch (works locally)
  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'ja-JP,ja;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function scrapeSurugaya(keyword: string): Promise<SurugayaProduct[]> {
  const url = `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(keyword)}&rankBy=new`;
  const html = await fetchHtml(url, true, 'jp');
  return extractProducts(html, keyword);
}

export async function getEbaySoldPrice(query: string): Promise<number> {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=40`;
  let html: string;
  try {
    html = await fetchHtml(url, false, 'us');
  } catch {
    return 0;
  }

  const prices: number[] = [];
  let m: RegExpExecArray | null;
  const dollarPattern = /\$([\d,]+\.\d{2})/g;
  while ((m = dollarPattern.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0.5 && val < 50000) prices.push(val);
  }
  if (prices.length === 0) return 0;
  prices.sort((a, b) => a - b);
  return prices[Math.floor(prices.length / 2)];
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
