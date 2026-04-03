import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  scrapeSurugaya,
  getEbaySoldPrice,
  getExchangeRate,
  translateToEnglish,
} from '@/lib/scraper';

const SCAN_TARGETS = [
  { keyword: 'ドラゴンクエスト ファミコン', category: 'game' },
  { keyword: 'ファイナルファンタジー スーパーファミコン', category: 'game' },
  { keyword: 'ポケモン ゲームボーイ カートリッジ', category: 'game' },
  { keyword: 'ゼルダの伝説 ファミコン', category: 'game' },
  { keyword: 'メガドライブ ソフト', category: 'game' },
  { keyword: 'フィギュア エヴァンゲリオン 限定', category: 'figure' },
  { keyword: 'ポケモンカード 旧裏 希少', category: 'card' },
  { keyword: 'ドラゴンボール カードダス', category: 'card' },
] as const;

const WEIGHT: Record<string, number> = {
  game: 400, card: 100, figure: 800, brand: 600, electronics: 1000, other: 500,
};

const EBAY_FEE = 0.13;
const MIN_PROFIT = 15;

function estimateShipping(category: string): number {
  const w = WEIGHT[category] || 500;
  return 2500 + Math.ceil(w / 100) * 200;
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

  let body: { keyword?: string; category?: string } = {};
  try { body = await req.json(); } catch {}

  // Round-robin keyword selection
  let targetIndex = 0;
  if (!body.keyword) {
    const { data } = await supabase.from('scan_state').select('next_index').eq('id', 1).single();
    targetIndex = (data?.next_index ?? 0) % SCAN_TARGETS.length;
    await supabase.from('scan_state').upsert({ id: 1, next_index: (targetIndex + 1) % SCAN_TARGETS.length });
  }

  const target = body.keyword
    ? { keyword: body.keyword, category: body.category || 'other' }
    : SCAN_TARGETS[targetIndex];

  const debug: any[] = [];
  let scanned = 0;
  let deals_found = 0;
  let notifications_sent = 0;
  const errors: string[] = [];

  try {
    const [products, rate] = await Promise.all([
      scrapeSurugaya(target.keyword),
      getExchangeRate(),
    ]);

    scanned = products.length;

    for (const product of products.slice(0, 3)) {
      try {
        const titleEn = await translateToEnglish(product.title_ja);
        const ebayUsd = await getEbaySoldPrice(titleEn);
        const ship = estimateShipping(target.category);
        const costUsd = (product.price_jpy + ship) * rate;
        const profit = ebayUsd * (1 - EBAY_FEE) - costUsd;

        debug.push({
          title_ja: product.title_ja,
          title_en: titleEn,
          price_jpy: product.price_jpy,
          ebay_usd: Math.round(ebayUsd * 100) / 100,
          shipping_jpy: ship,
          cost_usd: Math.round(costUsd * 100) / 100,
          profit_usd: Math.round(profit * 100) / 100,
          profitable: profit >= MIN_PROFIT,
        });

        if (ebayUsd === 0 || profit < MIN_PROFIT) continue;

        const margin = Math.round((profit / (ebayUsd * 0.87)) * 1000) / 10;

        const { error: dbErr } = await supabase.from('deals').insert({
          title_ja: product.title_ja,
          title_en: titleEn,
          source: 'surugaya',
          source_url: product.url,
          image_url: product.image_url || null,
          buy_price_jpy: product.price_jpy,
          shipping_estimate_jpy: ship,
          ebay_sell_price_usd: Math.round(ebayUsd * 100) / 100,
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
          const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(titleEn)}&LH_Sold=1`;

          const payload = isDiscord ? {
            embeds: [{
              title: `${emoji} ${titleEn}`,
              description: `JP: ${product.title_ja}`,
              color: profit >= 80 ? 0xFF4444 : profit >= 30 ? 0x00C851 : 0xFFD700,
              fields: [
                { name: '💴 Buy', value: `¥${product.price_jpy.toLocaleString()}`, inline: true },
                { name: '💰 eBay', value: `~$${ebayUsd.toFixed(0)}`, inline: true },
                { name: '✅ Profit', value: `**$${profit.toFixed(0)}** (${margin}%)`, inline: true },
              ],
              footer: { text: 'jpradar' },
              timestamp: new Date().toISOString(),
            }],
            components: [{ type: 1, components: [
              { type: 2, style: 5, label: '🛒 View', url: product.url },
              { type: 2, style: 5, label: '🔍 eBay', url: ebayUrl },
            ]}],
          } : {
            blocks: [{
              type: 'section',
              text: { type: 'mrkdwn', text: `${emoji} *${titleEn}*\n_${product.title_ja}_\n💴 ¥${product.price_jpy.toLocaleString()} → 💰 ~$${ebayUsd.toFixed(0)} → ✅ *$${profit.toFixed(0)} profit*` },
            }, {
              type: 'actions',
              elements: [
                { type: 'button', text: { type: 'plain_text', text: '🛒 View' }, url: product.url, style: 'primary' },
                { type: 'button', text: { type: 'plain_text', text: '🔍 eBay' }, url: ebayUrl },
              ],
            }],
          };

          try {
            await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            notifications_sent++;
          } catch {}
        }
      } catch (e: any) {
        errors.push(e.message);
      }
    }
  } catch (e: any) {
    errors.push(e.message);
  }

  return NextResponse.json({
    success: true,
    keyword: target.keyword,
    scanned,
    deals_found,
    notifications_sent,
    errors,
    debug,
  });
}
