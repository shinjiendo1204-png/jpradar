import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getExchangeRate, translateToEnglish } from '@/lib/scraper';

/**
 * Demand-first scan:
 * 1. Scrape eBay SOLD listings to find what's actually selling
 * 2. For each sold item, search Surugaya for the same item in Japan
 * 3. Calculate profit if found cheap in Japan
 */

const EBAY_SEARCHES = [
  { query: 'Pokemon card Japanese rare holographic', category: 'card', minPrice: 30 },
  { query: 'Super Famicom game Japan import rare', category: 'game', minPrice: 40 },
  { query: 'Famicom game cartridge Japan rare', category: 'game', minPrice: 40 },
  { query: 'Dragon Ball card Japanese vintage', category: 'card', minPrice: 20 },
  { query: 'anime figure limited Japan exclusive', category: 'figure', minPrice: 50 },
  { query: 'Game Boy Japan import cartridge', category: 'game', minPrice: 30 },
] as const;

const EBAY_FEE = 0.13;
const WEIGHT: Record<string, number> = {
  game: 400, card: 100, figure: 800, brand: 600, other: 500,
};

function estimateShipping(category: string): number {
  const w = WEIGHT[category] || 500;
  return 2500 + Math.ceil(w / 100) * 200;
}

async function fetchHtml(url: string, premium = false, country = 'us'): Promise<string> {
  const sbKey = process.env.SCRAPINGBEE_KEY;
  if (sbKey) {
    const params = new URLSearchParams({
      api_key: sbKey, url,
      render_js: 'false',
      premium_proxy: premium ? 'true' : 'false',
      country_code: country,
    });
    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
    if (!res.ok) throw new Error(`Scrapingbee ${res.status}`);
    return res.text();
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

interface EbaySoldItem {
  title: string;
  price_usd: number;
  url: string;
}

async function getEbaySoldItems(query: string, minPrice: number): Promise<EbaySoldItem[]> {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=20&_sop=13`;
  let html: string;
  try { html = await fetchHtml(url, true, 'us'); } catch { return []; }

  const items: EbaySoldItem[] = [];
  let m: RegExpExecArray | null;

  // Extract item titles from h3 tags (eBay sold listing structure)
  const titles: string[] = [];
  // Pattern 1: <h3 class="...s-item__title...">TITLE</h3>
  const h3Pattern = /<h3[^>]*s-item__title[^>]*>\s*([^<]{5,120})\s*<\/h3>/gi;
  while ((m = h3Pattern.exec(html)) !== null) {
    const t = m[1].trim().replace(/\s+/g, ' ');
    if (!t.includes('Shop on eBay') && t.length > 5) titles.push(t);
  }
  // Pattern 2: span role="heading" (alternate eBay structure)
  if (titles.length === 0) {
    const spanPattern = /<span role="heading"[^>]*>\s*([^<]{5,120})\s*<\/span>/gi;
    while ((m = spanPattern.exec(html)) !== null) {
      const t = m[1].trim();
      if (!t.includes('eBay') && t.length > 5) titles.push(t);
    }
  }

  // Extract prices (filter shipping fees < $5, keep real prices)
  const prices: number[] = [];
  const pricePattern = /\$([\d,]+\.\d{2})/g;
  while ((m = pricePattern.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val >= minPrice && val < 5000) prices.push(val);
  }

  // Extract item URLs
  const urlPattern = /href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)"/g;
  const urls: string[] = [];
  while ((m = urlPattern.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
    if (urls.length >= 20) break;
  }

  const count = Math.min(titles.length, prices.length, 5);
  for (let i = 0; i < count; i++) {
    items.push({
      title: titles[i],
      price_usd: prices[i],
      url: urls[i] || `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1`,
    });
  }

  return items;
}

async function searchSurugaya(query: string): Promise<{ title: string; price_jpy: number; url: string; image_url: string } | null> {
  const url = `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(query)}&rankBy=new`;
  let html: string;
  try { html = await fetchHtml(url, true, 'jp'); } catch { return null; }

  // Split by item_detail blocks
  const blocks = html.split('<div class="item_detail">');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.includes('品切れ') || block.includes('soldout')) continue;

    const linkMatch = block.match(/href="(\/product\/detail\/(\d+)[^"]*?)"/);
    if (!linkMatch) continue;

    const titleMatch = block.match(/<h3[^>]*class="product-name"[^>]*>\s*([^<]+?)\s*<\/h3>/);
    const title = titleMatch ? titleMatch[1].trim().replace(/&amp;/g, '&') : '';
    if (!title) continue;

    const cleanBlock = block
      .replace(/class="price_teika">[\s\S]*?<\/p>/g, '')
      .replace(/class="strike">[^<]*<\/[^>]+>/g, '');
    const priceMatch = cleanBlock.match(/[¥￥](\d[\d,]*)/);
    if (!priceMatch) continue;
    const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    if (price < 100 || price > 200000) continue;

    const imgMatch = block.match(/src="(https?:\/\/www\.suruga-ya\.jp[^"]+\.(?:jpg|jpeg|png)[^"]*?)"/);

    return {
      title,
      price_jpy: price,
      url: `https://www.suruga-ya.jp${linkMatch[1]}`,
      image_url: imgMatch ? imgMatch[1] : '',
    };
  }
  return null;
}

async function translateToJapanese(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return text;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Convert English product name to Japanese search query for Japanese used market. Keep brand names, use Japanese characters where applicable. Output only the search query, 2-4 words max.',
          },
          { role: 'user', content: text },
        ],
        max_tokens: 40, temperature: 0,
      }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch { return text; }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: { query?: string; category?: string; minPrice?: number } = {};
  try { body = await req.json(); } catch {}

  // Round-robin through EBAY_SEARCHES
  let targetIndex = 0;
  if (!body.query) {
    const { data } = await supabase.from('scan_state').select('next_index').eq('id', 1).single();
    targetIndex = (data?.next_index ?? 0) % EBAY_SEARCHES.length;
    await supabase.from('scan_state').upsert({ id: 1, next_index: (targetIndex + 1) % EBAY_SEARCHES.length });
  }

  const target = body.query
    ? { query: body.query, category: body.category || 'other', minPrice: body.minPrice || 20 }
    : EBAY_SEARCHES[targetIndex];

  const debug: any[] = [];
  let deals_found = 0;
  let notifications_sent = 0;
  const errors: string[] = [];

  try {
    const [soldItems, rate] = await Promise.all([
      getEbaySoldItems(target.query, target.minPrice),
      getExchangeRate(),
    ]);

    for (const item of soldItems.slice(0, 3)) {
      try {
        // Translate to Japanese for Surugaya search
        const jpQuery = await translateToJapanese(item.title);
        const jpResult = await searchSurugaya(jpQuery);

        const debugEntry: any = {
          ebay_title: item.title.slice(0, 50),
          ebay_price_usd: item.price_usd,
          jp_query: jpQuery,
          jp_found: !!jpResult,
          jp_title: jpResult?.title?.slice(0, 40) || null,
          jp_price_jpy: jpResult?.price_jpy || null,
        };

        if (!jpResult) {
          debug.push({ ...debugEntry, profit_usd: null, reason: 'not found in JP' });
          continue;
        }

        const ship = estimateShipping(target.category);
        const costUsd = (jpResult.price_jpy + ship) * rate;
        const profit = item.price_usd * (1 - EBAY_FEE) - costUsd;
        const margin = Math.round((profit / (item.price_usd * 0.87)) * 1000) / 10;

        debug.push({ ...debugEntry, shipping_jpy: ship, cost_usd: Math.round(costUsd*100)/100, profit_usd: Math.round(profit*100)/100, profitable: profit >= 15 });

        if (profit < 15) continue;

        const { error: dbErr } = await supabase.from('deals').insert({
          title_ja: jpResult.title,
          title_en: item.title,
          source: 'surugaya',
          source_url: jpResult.url,
          image_url: jpResult.image_url || null,
          buy_price_jpy: jpResult.price_jpy,
          shipping_estimate_jpy: ship,
          ebay_sell_price_usd: item.price_usd,
          net_profit_usd: Math.round(profit * 100) / 100,
          profit_margin_pct: margin,
          category: target.category,
        });

        if (dbErr) { errors.push(dbErr.message); continue; }
        deals_found++;

        // Notify users
        const { data: alerts } = await supabase
          .from('alerts').select('*').eq('is_active', true).lte('min_profit_usd', profit);

        for (const alert of (alerts || [])) {
          if (alert.category && alert.category !== target.category) continue;
          const webhook = alert.slack_webhook_url || alert.discord_webhook_url;
          if (!webhook) continue;

          const isDiscord = !!alert.discord_webhook_url;
          const emoji = profit >= 80 ? '🔥' : profit >= 30 ? '💚' : '🟡';
          const payload = isDiscord ? {
            embeds: [{
              title: `${emoji} ${item.title.slice(0, 80)}`,
              color: profit >= 80 ? 0xFF4444 : profit >= 30 ? 0x00C851 : 0xFFD700,
              fields: [
                { name: '✅ eBay Sold', value: `$${item.price_usd}`, inline: true },
                { name: '💴 Buy in Japan', value: `¥${jpResult.price_jpy.toLocaleString()}`, inline: true },
                { name: '💰 Net Profit', value: `**$${profit.toFixed(0)}** (${margin}%)`, inline: true },
              ],
              footer: { text: 'jpradar' },
              timestamp: new Date().toISOString(),
            }],
            components: [{ type: 1, components: [
              { type: 2, style: 5, label: '🛒 Buy in Japan', url: jpResult.url },
              { type: 2, style: 5, label: '📊 eBay Sold', url: item.url },
            ]}],
          } : {
            blocks: [{
              type: 'section',
              text: { type: 'mrkdwn', text: `${emoji} *${item.title.slice(0, 80)}*\n✅ eBay sold: $${item.price_usd} → 💴 Buy JP: ¥${jpResult.price_jpy.toLocaleString()} → 💰 *$${profit.toFixed(0)} profit*` },
            }, {
              type: 'actions',
              elements: [
                { type: 'button', text: { type: 'plain_text', text: '🛒 Buy in Japan' }, url: jpResult.url, style: 'primary' },
                { type: 'button', text: { type: 'plain_text', text: '📊 eBay Sold' }, url: item.url },
              ],
            }],
          };

          try {
            await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            notifications_sent++;
          } catch {}
        }
      } catch (e: any) { errors.push(e.message); }
    }
  } catch (e: any) { errors.push(e.message); }

  return NextResponse.json({
    success: true,
    query: target.query,
    deals_found,
    notifications_sent,
    errors,
    debug,
  });
}
