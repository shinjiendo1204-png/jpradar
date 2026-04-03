import { NextRequest, NextResponse } from 'next/server';
import { getEbaySoldPrice } from '@/lib/scraper';

/**
 * eBay sold price lookup.
 * Uses Scrapingbee (if SCRAPINGBEE_KEY is set) to bypass IP blocks.
 */

const cache = new Map<string, { price: number; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: 'Missing ?q=' }, { status: 400 });
  }

  const key = query.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({
      search_term: query, currency: 'USD',
      avg_price_usd: cached.price, median_price_usd: cached.price,
      min_price_usd: 0, max_price_usd: 0,
      sample_count: cached.price > 0 ? 1 : 0,
      source: 'ebay_sold', cached: true,
      fetched_at: new Date().toISOString(),
    });
  }

  try {
    const price = await getEbaySoldPrice(query);
    cache.set(key, { price, expiresAt: Date.now() + CACHE_TTL });

    return NextResponse.json({
      search_term: query, currency: 'USD',
      avg_price_usd: price, median_price_usd: price,
      min_price_usd: 0, max_price_usd: 0,
      sample_count: price > 0 ? 1 : 0,
      source: 'ebay_sold',
      ebay_search_url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`,
      fetched_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
