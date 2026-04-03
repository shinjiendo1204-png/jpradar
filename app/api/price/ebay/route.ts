import { NextRequest, NextResponse } from 'next/server';
import type { EbayPriceResult } from '@/lib/types';

/**
 * eBay Sold Listings price lookup — NO API KEY REQUIRED.
 *
 * Scrapes eBay's completed/sold search page directly.
 * Sold prices = actual market prices, more accurate than listing prices.
 *
 * URL: https://www.ebay.com/sch/i.html?_nkw={query}&LH_Sold=1&LH_Complete=1
 *
 * Cache: 60 minutes in-memory
 */

const priceCache = new Map<string, { data: EbayPriceResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function extractSoldPrices(html: string): number[] {
  const prices: number[] = [];
  let m: RegExpExecArray | null;

  // Pattern 1: s-item__price spans — "US $24.99"
  const p1 = /class="s-item__price"[^>]*>\s*(?:US\s*)?\$\s*([\d,]+\.?\d*)/gi;
  while ((m = p1.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0.5 && val < 50000) prices.push(val);
  }

  // Pattern 2: data-price attributes
  const p2 = /data-price="([\d.]+)"/g;
  while ((m = p2.exec(html)) !== null) {
    const val = parseFloat(m[1]);
    if (val > 0.5 && val < 50000) prices.push(val);
  }

  return [...new Set(prices)].sort((a, b) => a - b);
}

async function fetchEbaySoldPrices(query: string): Promise<EbayPriceResult> {
  const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=60`;

  const res = await fetch(ebaySearchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`eBay fetch failed: ${res.status}`);
  const html = await res.text();
  const prices = extractSoldPrices(html);

  if (prices.length === 0) {
    return {
      search_term: query, currency: 'USD',
      avg_price_usd: 0, median_price_usd: 0,
      min_price_usd: 0, max_price_usd: 0,
      sample_count: 0, source: 'ebay_sold',
      ebay_search_url: ebaySearchUrl,
      fetched_at: new Date().toISOString(),
    };
  }

  // Trim outliers (keep middle 80%)
  const trimStart = Math.floor(prices.length * 0.1);
  const trimEnd = Math.ceil(prices.length * 0.9);
  const trimmed = prices.slice(trimStart, trimEnd);
  const avg = trimmed.length > 0
    ? trimmed.reduce((s, p) => s + p, 0) / trimmed.length
    : prices.reduce((s, p) => s + p, 0) / prices.length;
  const median = prices[Math.floor(prices.length / 2)];

  return {
    search_term: query, currency: 'USD',
    avg_price_usd: Math.round(avg * 100) / 100,
    median_price_usd: Math.round(median * 100) / 100,
    min_price_usd: Math.round(prices[0] * 100) / 100,
    max_price_usd: Math.round(prices[prices.length - 1] * 100) / 100,
    sample_count: prices.length,
    source: 'ebay_sold',
    ebay_search_url: ebaySearchUrl,
    fetched_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: 'Missing ?q=' }, { status: 400 });
  }

  const cacheKey = query.toLowerCase().trim();
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const result = await fetchEbaySoldPrices(query);
    priceCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
