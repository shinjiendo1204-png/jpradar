import { NextRequest, NextResponse } from 'next/server';
import type { DealCalculation } from '@/lib/types';

/**
 * Core profit calculation engine.
 * Japan used market price → translate → overseas market price → net profit after shipping + fees.
 *
 * Shipping: tenso.com forwarding estimates
 * Fees: eBay 13%
 * Exchange rate: live from exchangerate-api.com with fallback
 */

type Category = 'game' | 'figure' | 'card' | 'brand' | 'electronics' | 'other';
type Destination = 'US' | 'EU' | 'AU';

const WEIGHT_BY_CATEGORY: Record<Category, number> = {
  game: 400,
  card: 100,
  figure: 800,
  brand: 600,
  electronics: 1000,
  other: 500,
};

const SHIPPING_RATES: Record<Destination, { base: number; per100g: number }> = {
  US: { base: 2500, per100g: 200 },
  EU: { base: 2800, per100g: 250 },
  AU: { base: 2600, per100g: 220 },
};

const PLATFORM_FEES: Record<string, number> = {
  ebay: 0.13,
  whatnot: 0.08,
  etsy: 0.065,
  amazon: 0.15,
};

function getBestPlatform(category: Category): DealCalculation['best_platform'] {
  if (category === 'card' || category === 'figure') return 'whatnot';
  if (category === 'electronics') return 'amazon';
  return 'ebay';
}

async function translateToEnglish(text: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return text;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Translate Japanese product names to English for eBay/resale search. Keep brand names, numbers, model codes. Be concise. Output only the translation.',
          },
          { role: 'user', content: text },
        ],
        max_tokens: 100,
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

async function getExchangeRate(): Promise<number> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/JPY', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    return data.rates?.USD || 0.0067;
  } catch {
    return 0.0067; // ~¥149/$1 fallback
  }
}

async function getMarketPrice(query: string): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/price/ebay?q=${encodeURIComponent(query)}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.median_price_usd || data.avg_price_usd || 0;
  } catch {
    return 0;
  }
}

function estimateShipping(weightG: number, destination: Destination): number {
  const r = SHIPPING_RATES[destination];
  return r.base + Math.ceil(weightG / 100) * r.per100g;
}

function getProfitTier(profit: number): DealCalculation['profit_tier'] {
  if (profit >= 80) return 'excellent';
  if (profit >= 30) return 'high';
  if (profit >= 10) return 'medium';
  return 'low';
}

export async function POST(req: NextRequest) {
  let body: {
    title_ja: string;
    price_jpy: number;
    weight_g?: number;
    category?: Category;
    destination?: Destination;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title_ja, price_jpy, weight_g, category = 'other', destination = 'US' } = body;

  if (!title_ja || !price_jpy) {
    return NextResponse.json({ error: 'Missing title_ja or price_jpy' }, { status: 400 });
  }

  try {
    const [title_en, exchangeRate] = await Promise.all([
      translateToEnglish(title_ja),
      getExchangeRate(),
    ]);

    const marketPriceUsd = await getMarketPrice(title_en);
    const weightEstimate = weight_g ?? WEIGHT_BY_CATEGORY[category];
    const shippingJpy = estimateShipping(weightEstimate, destination);
    const totalCostJpy = price_jpy + shippingJpy;
    const totalCostUsd = totalCostJpy * exchangeRate;
    const ebayFeeUsd = marketPriceUsd * PLATFORM_FEES.ebay;
    const netProfitUsd = marketPriceUsd * (1 - PLATFORM_FEES.ebay) - totalCostUsd;
    const profitMarginPct = marketPriceUsd > 0
      ? Math.round((netProfitUsd / (marketPriceUsd * 0.87)) * 1000) / 10
      : 0;
    const roiPct = totalCostUsd > 0
      ? Math.round((netProfitUsd / totalCostUsd) * 1000) / 10
      : 0;

    const result: DealCalculation = {
      title_ja,
      title_en,
      buy_price_jpy: price_jpy,
      shipping_estimate_jpy: shippingJpy,
      total_cost_jpy: totalCostJpy,
      total_cost_usd: Math.round(totalCostUsd * 100) / 100,
      ebay_sell_price_usd: Math.round(marketPriceUsd * 100) / 100,
      ebay_fee_usd: Math.round(ebayFeeUsd * 100) / 100,
      net_profit_usd: Math.round(netProfitUsd * 100) / 100,
      profit_margin_pct: profitMarginPct,
      roi_pct: roiPct,
      is_profitable: netProfitUsd > 5,
      profit_tier: getProfitTier(netProfitUsd),
      best_platform: getBestPlatform(category),
      ebay_listings_url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title_en)}&LH_ItemCondition=3000`,
      exchange_rate: exchangeRate,
      calculated_at: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
