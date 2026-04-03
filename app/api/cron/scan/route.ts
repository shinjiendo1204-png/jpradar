import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Main scan cron job.
 * Scrapes Japanese used markets, calculates profit, saves deals, sends notifications.
 *
 * Schedule (vercel.json): every 2 hours
 * { "crons": [{ "path": "/api/cron/scan", "schedule": "0-every-2h" -- see vercel.json
 *
 * Auth: POST with Authorization: Bearer {CRON_SECRET}
 */

// Keywords to scan with their categories
const SCAN_TARGETS = [
  { keyword: 'レトロゲーム', category: 'game' },
  { keyword: 'ゲームソフト ファミコン', category: 'game' },
  { keyword: 'ゲームボーイ ソフト', category: 'game' },
  { keyword: 'スーパーファミコン ソフト', category: 'game' },
  { keyword: 'プレイステーション ソフト', category: 'game' },
  { keyword: 'フィギュア 限定', category: 'figure' },
  { keyword: 'トレーディングカード ポケモン', category: 'card' },
] as const;

const MIN_PROFIT_TO_SAVE = 15; // USD
const MAX_PRODUCTS_PER_KEYWORD = 5;
const CRAWL_DELAY_MS = 31000; // Respect surugaya's 30s crawl-delay

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jpradar.app';

  const results = {
    scanned: 0,
    deals_found: 0,
    notifications_sent: 0,
    errors: [] as string[],
    started_at: new Date().toISOString(),
  };

  for (const target of SCAN_TARGETS) {
    try {
      // 1. Scrape surugaya
      const scrapeRes = await fetch(
        `${baseUrl}/api/scrape/surugaya?keyword=${encodeURIComponent(target.keyword)}`,
        { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }
      );

      if (!scrapeRes.ok) {
        results.errors.push(`Scrape failed for ${target.keyword}: ${scrapeRes.status}`);
        continue;
      }

      const { products } = await scrapeRes.json();
      if (!products?.length) continue;

      results.scanned += products.length;
      const sample = products.slice(0, MAX_PRODUCTS_PER_KEYWORD);

      // 2. Calculate profit for each product
      for (const product of sample) {
        try {
          const calcRes = await fetch(`${baseUrl}/api/deals/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title_ja: product.title_ja,
              price_jpy: product.price_jpy,
              category: target.category,
              destination: 'US',
            }),
          });

          if (!calcRes.ok) continue;
          const deal = await calcRes.json();

          // 3. Only save if profitable enough
          if (!deal.net_profit_usd || deal.net_profit_usd < MIN_PROFIT_TO_SAVE) continue;

          // 4. Save deal to DB
          const { data: savedDeal, error: dbError } = await supabase
            .from('deals')
            .insert({
              title_ja: product.title_ja,
              title_en: deal.title_en,
              source: 'surugaya',
              source_url: product.url,
              image_url: product.image_url || null,
              buy_price_jpy: product.price_jpy,
              shipping_estimate_jpy: deal.shipping_estimate_jpy,
              ebay_sell_price_usd: deal.ebay_sell_price_usd,
              net_profit_usd: deal.net_profit_usd,
              profit_margin_pct: deal.profit_margin_pct,
              category: target.category,
            })
            .select()
            .single();

          if (dbError) {
            results.errors.push(`DB insert error: ${dbError.message}`);
            continue;
          }

          results.deals_found++;

          // 5. Find matching user alerts
          const { data: alerts } = await supabase
            .from('alerts')
            .select('*')
            .eq('is_active', true)
            .lte('min_profit_usd', deal.net_profit_usd);

          for (const alert of (alerts || [])) {
            // Filter by category if set
            if (alert.category && alert.category !== target.category) continue;

            const webhookUrl = alert.slack_webhook_url || alert.discord_webhook_url;
            if (!webhookUrl) continue;

            const webhookType = alert.slack_webhook_url ? 'slack' : 'discord';

            try {
              await fetch(`${baseUrl}/api/notify/slack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  webhook_url: webhookUrl,
                  webhook_type: webhookType,
                  deal: {
                    ...deal,
                    source_url: product.url,
                    image_url: product.image_url,
                  },
                }),
              });
              results.notifications_sent++;
            } catch (notifyErr: any) {
              results.errors.push(`Notify error: ${notifyErr.message}`);
            }
          }

          // Small delay between products to be respectful
          await new Promise(r => setTimeout(r, 1000));
        } catch (productErr: any) {
          results.errors.push(`Product error: ${productErr.message}`);
        }
      }

      // Respect surugaya's 30s crawl-delay between keyword searches
      await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
    } catch (keywordErr: any) {
      results.errors.push(`Keyword "${target.keyword}" error: ${keywordErr.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    finished_at: new Date().toISOString(),
  });
}
