/**
 * Shared types used across API routes and components.
 */

export interface DealCalculation {
  title_ja: string;
  title_en: string;
  buy_price_jpy: number;
  shipping_estimate_jpy: number;
  total_cost_jpy: number;
  total_cost_usd: number;
  ebay_sell_price_usd: number;
  ebay_fee_usd: number;
  net_profit_usd: number;
  profit_margin_pct: number;
  roi_pct: number;
  is_profitable: boolean;
  profit_tier: 'low' | 'medium' | 'high' | 'excellent';
  best_platform: 'ebay' | 'whatnot' | 'etsy' | 'amazon';
  ebay_listings_url: string;
  exchange_rate: number;
  calculated_at: string;
}

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

export interface EbayPriceResult {
  search_term: string;
  currency: 'USD';
  avg_price_usd: number;
  median_price_usd: number;
  min_price_usd: number;
  max_price_usd: number;
  sample_count: number;
  source: 'ebay_sold' | 'pricecharting';
  ebay_search_url?: string;
  fetched_at: string;
}
