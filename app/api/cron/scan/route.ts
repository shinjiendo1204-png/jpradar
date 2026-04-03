import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  scrapeSurugaya,
  getEbaySoldPrice,
  getExchangeRate,
  translateToEnglish,
} from '@/lib/scraper';

/**
 * Scan cron — processes ONE keyword per invocation to stay within
 * Vercel's 10s function timeout (Hobby plan).
 *
 * Rotates through keywords using a pointer stored in Supabase.
 * Run daily via vercel.json; call manually for testing.
 *
 * Auth: POST with Authorization: Bearer {CRON_SECRET}
 * Override keyword: POST body { keyword?: string, category?: string }
 */

const SCAN_TARGETS = [
  { keyword: 'レトロゲーム', category: 'game' },
  { keyword: 'ゲームソフト ファミコン', category: 'game' },
  { keyword: 'スーパーファミコン ソフト', category: 'game' },
  { keyword: 'フィギュア 限定', category: 'figure' },
  { keyword: 'トレーディングカード ポケモン', category: 'card' },
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

  // Allow manual override via body
  let body: { keyword?: string; category?: string } = {};
  try { body = await req.json(); } catch {}

  // Determine which keyword to scan next (round-robin)
  let targetIndex = 0;
  if (!body.keyword) {
    const { data } = await supabase
      .from('scan_state')
      .select('next_index')
      .eq('id', 1)
      .single();
    targetIndex = (data?.next_index ?? 0) % SCAN_TARGETS.length;

    // Advance pointer for next run
    await supabase
      .from('scan_state')
      .upsert({ id: 1, next_index: (targetIndex + 1) % SCAN_TARGETS.length });
  }

  const target = body.keyword
    ? { keyword: body.keyword, category: body.category || 'other' }
    : SCAN_TARGETS[targetIndex];

  const results = {
    keyword: target.keyword,
    scanned: 0,
    deals_found: 0,
    notifications_sent: 0,
    errors: [] as string[],
  };

  try {
    const [products, exchangeRate] = await Promise.all([
      scrapeSurugaya(target.keyword),
      getExchangeRate(),
    ]);

    results.scanned = products.length;

    for (const product of products.slice(0, 3)) { // max 3 per run to stay fast
      try {
        const titleEn = await translateToEnglish(product.title_ja);
        const ebayPrice = await getEbaySoldPrice(titleEn);
        if (ebayPrice === 0) continue;

        const shippingJpy = estimateShipping(target.category);
        const totalCostUsd = (product.price_jpy + shippingJpy) * exchangeRate;
        const netProfitUsd = ebayPrice * (1 - EBAY_FEE) - totalCostUsd;
        if (netProfitUsd < MIN_PROFIT) continue;

        const profitMarginPct = Math.round((netProfitUsd / (ebayPrice * 0.87)) * 1000) / 10;

        const { error: dbError } = await supabase.from('deals').insert({
          title_ja: product.title_ja,
          title_en: titleEn,
          source: 'surugaya',
          source_url: product.url,
          image_url: product.image_url || null,
          buy_price_jpy: product.price_jpy,
          shipping_estimate_jpy: shippingJpy,
          ebay_sell_price_usd: Math.round(ebayPrice * 100) / 100,
          net_profit_usd: Math.round(netProfitUsd * 100) / 100,
          profit_margin_pct: profitMarginPct,
          category: target.category,
        });

        if (dbError) { results.errors.push(dbError.message); continue; }
        results.deals_found++;

        // Notify users
        const { data: alerts } = await supabase
          .from('alerts').select('*').eq('is_active', true)
          .lte('min_profit_usd', netProfitUsd);

        for (const alert of (alerts || [])) {
          if (alert.category && alert.category !== target.category) continue;
          const webhookUrl = alert.slack_webhook_url || alert.discord_webhook_url;
          if (!webhookUrl) continue;

          const isDiscord = !!alert.discord_webhook_url;
          const tierEmoji = netProfitUsd >= 80 ? '🔥' : netProfitUsd >= 30 ? '💚' : '🟡';
          const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(titleEn)}&LH_Sold=1`;

          const payload = isDiscord ? {
            embeds: [{
              title: `${tierEmoji} ${titleEn}`,
              description: `JP: ${product.title_ja}`,
              color: netProfitUsd >= 80 ? 0xFF4444 : netProfitUsd >= 30 ? 0x00C851 : 0xFFD700,
              fields: [
                { name: '💴 Buy', value: `¥${product.price_jpy.toLocaleString()}`, inline: true },
                { name: '💰 eBay Sell', value: `~$${ebayPrice.toFixed(0)}`, inline: true },
                { name: '✅ Net Profit', value: `**$${netProfitUsd.toFixed(0)}** (${profitMarginPct}%)`, inline: true },
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
              text: { type: 'mrkdwn', text: `${tierEmoji} *${titleEn}*\n_${product.title_ja}_\n💴 ¥${product.price_jpy.toLocaleString()} → 💰 ~$${ebayPrice.toFixed(0)} → ✅ *$${netProfitUsd.toFixed(0)} profit*` },
            }, {
              type: 'actions',
              elements: [
                { type: 'button', text: { type: 'plain_text', text: '🛒 View' }, url: product.url, style: 'primary' },
                { type: 'button', text: { type: 'plain_text', text: '🔍 eBay' }, url: ebayUrl },
              ],
            }],
          };

          try {
            await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            results.notifications_sent++;
          } catch {}
        }
      } catch (e: any) {
        results.errors.push(e.message);
      }
    }
  } catch (e: any) {
    results.errors.push(e.message);
  }

  return NextResponse.json({ success: true, ...results });
}
