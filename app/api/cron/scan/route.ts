import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  scrapeSurugaya,
  getEbaySoldPrice,
  getExchangeRate,
  translateToEnglish,
} from '@/lib/scraper';

/**
 * Main scan cron job — runs daily (Vercel Hobby plan).
 * Directly imports scraper functions instead of internal HTTP calls.
 * Auth: POST with Authorization: Bearer {CRON_SECRET}
 */

const SCAN_TARGETS = [
  { keyword: 'レトロゲーム', category: 'game' },
  { keyword: 'ゲームソフト ファミコン', category: 'game' },
  { keyword: 'ゲームボーイ ソフト', category: 'game' },
  { keyword: 'スーパーファミコン ソフト', category: 'game' },
  { keyword: 'フィギュア 限定', category: 'figure' },
  { keyword: 'トレーディングカード ポケモン', category: 'card' },
] as const;

const WEIGHT: Record<string, number> = {
  game: 400, card: 100, figure: 800, brand: 600, electronics: 1000, other: 500,
};

const SHIPPING_BASE = 2500;
const SHIPPING_PER_100G = 200;
const EBAY_FEE = 0.13;
const MIN_PROFIT = 15;

function estimateShipping(category: string): number {
  const w = WEIGHT[category] || 500;
  return SHIPPING_BASE + Math.ceil(w / 100) * SHIPPING_PER_100G;
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

  const results = {
    scanned: 0,
    deals_found: 0,
    notifications_sent: 0,
    errors: [] as string[],
    started_at: new Date().toISOString(),
  };

  // Get exchange rate once
  const exchangeRate = await getExchangeRate();

  for (const target of SCAN_TARGETS) {
    try {
      const products = await scrapeSurugaya(target.keyword);
      results.scanned += products.length;

      for (const product of products.slice(0, 5)) {
        try {
          // Translate and look up eBay price in parallel
          const [titleEn, ebayPrice] = await Promise.all([
            translateToEnglish(product.title_ja),
            getEbaySoldPrice(product.title_ja), // try Japanese first
          ]);

          // If Japanese search returned nothing, try English
          const finalPrice = ebayPrice > 0
            ? ebayPrice
            : await getEbaySoldPrice(titleEn);

          if (finalPrice === 0) continue;

          const shippingJpy = estimateShipping(target.category);
          const totalCostUsd = (product.price_jpy + shippingJpy) * exchangeRate;
          const netProfitUsd = finalPrice * (1 - EBAY_FEE) - totalCostUsd;

          if (netProfitUsd < MIN_PROFIT) continue;

          const profitMarginPct = Math.round((netProfitUsd / (finalPrice * 0.87)) * 1000) / 10;

          // Save deal
          const { data: savedDeal, error: dbError } = await supabase
            .from('deals')
            .insert({
              title_ja: product.title_ja,
              title_en: titleEn,
              source: 'surugaya',
              source_url: product.url,
              image_url: product.image_url || null,
              buy_price_jpy: product.price_jpy,
              shipping_estimate_jpy: shippingJpy,
              ebay_sell_price_usd: Math.round(finalPrice * 100) / 100,
              net_profit_usd: Math.round(netProfitUsd * 100) / 100,
              profit_margin_pct: profitMarginPct,
              category: target.category,
            })
            .select()
            .single();

          if (dbError) {
            results.errors.push(`DB: ${dbError.message}`);
            continue;
          }

          results.deals_found++;

          // Notify matching users
          const { data: alerts } = await supabase
            .from('alerts')
            .select('*')
            .eq('is_active', true)
            .lte('min_profit_usd', netProfitUsd);

          for (const alert of (alerts || [])) {
            if (alert.category && alert.category !== target.category) continue;
            const webhookUrl = alert.slack_webhook_url || alert.discord_webhook_url;
            if (!webhookUrl) continue;

            const isDiscord = !!alert.discord_webhook_url;
            const tierEmoji = netProfitUsd >= 80 ? '🔥' : netProfitUsd >= 30 ? '💚' : '🟡';
            const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(titleEn)}&LH_Sold=1`;

            const payload = isDiscord ? {
              embeds: [{
                title: `${tierEmoji} ${titleEn}`,
                description: `*JP: ${product.title_ja}*`,
                color: netProfitUsd >= 80 ? 0xFF4444 : netProfitUsd >= 30 ? 0x00C851 : 0xFFD700,
                fields: [
                  { name: '💴 Buy', value: `¥${product.price_jpy.toLocaleString()}`, inline: true },
                  { name: '📦 Ship', value: `¥${shippingJpy.toLocaleString()}`, inline: true },
                  { name: '💰 Sell on eBay', value: `~$${finalPrice.toFixed(0)}`, inline: true },
                  { name: '✅ Net Profit', value: `**$${netProfitUsd.toFixed(0)}**`, inline: true },
                  { name: '📈 Margin', value: `${profitMarginPct}%`, inline: true },
                ],
                footer: { text: 'jpradar • Japan Arbitrage Scanner' },
                timestamp: new Date().toISOString(),
              }],
              components: [{
                type: 1,
                components: [
                  { type: 2, style: 5, label: '🛒 View Product', url: product.url },
                  { type: 2, style: 5, label: '🔍 Check eBay', url: ebaySearchUrl },
                ],
              }],
            } : {
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `${tierEmoji} *${titleEn}*\n_JP: ${product.title_ja}_\n\n💴 Buy ¥${product.price_jpy.toLocaleString()} → 💰 Sell ~$${finalPrice.toFixed(0)} → ✅ *Net $${netProfitUsd.toFixed(0)} (${profitMarginPct}%)*`,
                  },
                },
                {
                  type: 'actions',
                  elements: [
                    { type: 'button', text: { type: 'plain_text', text: '🛒 View Product' }, url: product.url, style: 'primary' },
                    { type: 'button', text: { type: 'plain_text', text: '🔍 Check eBay' }, url: ebaySearchUrl },
                  ],
                },
              ],
            };

            try {
              await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              results.notifications_sent++;
            } catch (e: any) {
              results.errors.push(`Notify: ${e.message}`);
            }
          }

          await new Promise(r => setTimeout(r, 500));
        } catch (e: any) {
          results.errors.push(`Product: ${e.message}`);
        }
      }

      // Respect crawl-delay between keywords
      await new Promise(r => setTimeout(r, 32000));
    } catch (e: any) {
      results.errors.push(`Keyword "${target.keyword}": ${e.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    finished_at: new Date().toISOString(),
  });
}
