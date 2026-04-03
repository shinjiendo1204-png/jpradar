/**
 * J-Clarity V-Function v2: Purchasing Power Model
 *
 * Redesigned scoring to prevent saturation and better differentiate streamers.
 *
 * Key insight: A 1,000-viewer streamer who drives 10 purchases
 * is more valuable than a 100,000-viewer streamer who drives 5 purchases.
 *
 * Score (0-100) components:
 * - Reach Efficiency (0-30): viewers relative to category average, not absolute
 * - Conversion Evidence (0-40): actual review delta per stream — the king metric
 * - Engagement Quality (0-20): engagement rate (clips/chat relative to viewers)
 * - Genre Fit (0-10): how well this streamer aligns with your game's category
 */

export interface VFunctionInput {
  avg_view_count: number;
  avg_category_views?: number;    // average for this game's category (optional)
  review_delta_per_stream: number; // attributed Steam reviews after broadcast
  engagement_rate?: number;        // 0-1: high-quality interactions per viewer
  genre_fit: number;               // 0-1
  peak_hour_bonus?: number;        // 0.8-1.2
}

export interface VFunctionOutput {
  v_score: number;
  tier: 'S' | 'A' | 'B' | 'C';
  cbi_index: number;
  interpretation: string;
  components: {
    reach_efficiency: number;
    conversion: number;
    engagement: number;
    fit: number;
  };
  estimated_purchases_per_stream: { low: number; mid: number; high: number };
}

export function calcVFunction(input: VFunctionInput): VFunctionOutput {
  const {
    avg_view_count,
    avg_category_views = 5000,
    review_delta_per_stream,
    engagement_rate = 0,
    genre_fit,
    peak_hour_bonus = 1.0,
  } = input;

  // 1. Reach Efficiency (0-30)
  // Ratio of streamer's avg viewers vs category average
  // 1x avg = 15pts, 2x = 20, 5x = 25, 10x = 28, capped at 30
  const reachRatio = avg_view_count / Math.max(avg_category_views, 100);
  const reachEfficiency = Math.min(10 + Math.log10(reachRatio + 0.1) * 15, 30);

  // 2. Conversion Evidence (0-40) — most important metric
  // 0 reviews/stream = 0pts
  // 1 review/stream = 5pts
  // 5 reviews/stream = 15pts
  // 20 reviews/stream = 25pts
  // 100 reviews/stream = 35pts
  // 500+ = 40pts
  const conversionScore = review_delta_per_stream <= 0
    ? 0
    : Math.min(Math.log10(review_delta_per_stream + 1) * 20, 40);

  // 3. Engagement Quality (0-20)
  // If engagement_rate is not available, estimate from view count patterns
  // High-engagement streamers have chat/clips per viewer above average
  const engScore = Math.min(engagement_rate * 20, 20);

  // 4. Genre Fit (0-10)
  const fitScore = Math.min(genre_fit * 10, 10);

  const rawScore = (reachEfficiency + conversionScore + engScore + fitScore) * peak_hour_bonus;
  const v_score = Math.max(0, Math.min(Math.round(rawScore), 100));

  // Tier
  const tier: VFunctionOutput['tier'] =
    v_score >= 65 ? 'S' :
    v_score >= 45 ? 'A' :
    v_score >= 25 ? 'B' : 'C';

  // CBI: based on conversion rate relative to reach
  const conversionRate = avg_view_count > 0
    ? (review_delta_per_stream / avg_view_count) * 100
    : 0;
  const cbi_index = Math.min(Math.round(conversionRate * 50), 100);

  // Estimated purchases (conversion rate × avg viewers)
  // Base rate varies by tier
  const baseRate = tier === 'S' ? 0.012 : tier === 'A' ? 0.007 : tier === 'B' ? 0.003 : 0.001;
  // If we have actual conversion data, use it
  const evidenceRate = avg_view_count > 0 ? review_delta_per_stream / avg_view_count : 0;
  const effectiveRate = evidenceRate > 0 ? (baseRate + evidenceRate) / 2 : baseRate;
  const midPurchases = Math.round(avg_view_count * effectiveRate);

  const interpretation =
    v_score >= 65 ? 'Top converter. Strong evidence of purchase-driving ability.' :
    v_score >= 45 ? 'High performer. Good conversion signal with solid reach.' :
    v_score >= 25 ? 'Average performer. Useful for awareness, moderate conversion.' :
    conversionScore === 0
      ? 'No conversion data yet. Run a test campaign to measure real impact.'
      : 'Low conversion signal. May not justify direct sales campaign.';

  return {
    v_score,
    tier,
    cbi_index,
    interpretation,
    components: {
      reach_efficiency: Math.round(reachEfficiency * 10) / 10,
      conversion: Math.round(conversionScore * 10) / 10,
      engagement: Math.round(engScore * 10) / 10,
      fit: Math.round(fitScore * 10) / 10,
    },
    estimated_purchases_per_stream: {
      low: Math.max(0, Math.round(midPurchases * 0.5)),
      mid: midPurchases,
      high: Math.round(midPurchases * 2.5),
    },
  };
}

export const CBI_WEIGHTS = {
  strong_intent: { keywords: ['買った', '買います', 'buy', 'purchased', 'bought', '落とした', '購入'], weight: 3.0 },
  mid_intent:    { keywords: ['欲しい', '気になる', 'want', 'interested', 'considering', '買おうかな'], weight: 1.5 },
  weak_intent:   { keywords: ['面白そう', '神ゲー', 'looks fun', 'nice', 'いいな', 'やってみたい'], weight: 0.5 },
};

export function calcCBIFromComments(comments: string[]): {
  cbi_score: number;
  strong_count: number;
  mid_count: number;
  weak_count: number;
  total_buy_signals: number;
} {
  let strongCount = 0, midCount = 0, weakCount = 0;
  for (const comment of comments) {
    const lower = comment.toLowerCase();
    if (CBI_WEIGHTS.strong_intent.keywords.some(k => lower.includes(k))) strongCount++;
    else if (CBI_WEIGHTS.mid_intent.keywords.some(k => lower.includes(k))) midCount++;
    else if (CBI_WEIGHTS.weak_intent.keywords.some(k => lower.includes(k))) weakCount++;
  }
  const totalSignals = strongCount * 3 + midCount * 1.5 + weakCount * 0.5;
  const cbiScore = comments.length > 0
    ? Math.min(Math.round((totalSignals / comments.length) * 1000), 100)
    : 0;
  return { cbi_score: cbiScore, strong_count: strongCount, mid_count: midCount, weak_count: weakCount, total_buy_signals: strongCount + midCount + weakCount };
}

export interface StreamerForOptimizer {
  username: string;
  estimated_cost_jpy: number;
  v_score: number;
  tier: 'S' | 'A' | 'B' | 'C';
  estimated_purchases_mid: number;
  genre_fit: boolean;
  avg_view_count: number;
}

export interface OptimizedPortfolio {
  selected_streamers: (StreamerForOptimizer & { role: string; day: number })[];
  total_cost_jpy: number;
  total_estimated_purchases: { low: number; mid: number; high: number };
  cost_per_purchase_jpy: number;
  strategy_note: string;
}

export function optimizeBudget(streamers: StreamerForOptimizer[], budget_jpy: number): OptimizedPortfolio {
  const sorted = [...streamers].sort((a, b) => b.v_score - a.v_score);
  const selected: (StreamerForOptimizer & { role: string; day: number })[] = [];
  let remaining = budget_jpy;

  const fireStarter = sorted.find(s => s.estimated_cost_jpy <= remaining * 0.4 && s.tier !== 'C');
  if (fireStarter) {
    selected.push({ ...fireStarter, role: '🔥 Fire Starter', day: 1 });
    remaining -= fireStarter.estimated_cost_jpy;
  }
  const deepDive = sorted.find(s => s.genre_fit && s.estimated_cost_jpy <= remaining * 0.5 && s.username !== fireStarter?.username);
  if (deepDive) {
    selected.push({ ...deepDive, role: '🎮 Genre Expert', day: 4 });
    remaining -= deepDive.estimated_cost_jpy;
  }
  const harvest = sorted
    .filter(s => s.username !== fireStarter?.username && s.username !== deepDive?.username)
    .sort((a, b) => b.avg_view_count - a.avg_view_count)
    .find(s => s.estimated_cost_jpy <= remaining);
  if (harvest) {
    selected.push({ ...harvest, role: '📈 Amplifier', day: 7 });
    remaining -= harvest.estimated_cost_jpy;
  }

  const totalCost = budget_jpy - remaining;
  const totalMid = selected.reduce((s, st) => s + st.estimated_purchases_mid, 0);
  return {
    selected_streamers: selected,
    total_cost_jpy: totalCost,
    total_estimated_purchases: {
      low: Math.round(totalMid * 0.5),
      mid: totalMid,
      high: Math.round(totalMid * 2),
    },
    cost_per_purchase_jpy: totalMid > 0 ? Math.round(totalCost / totalMid) : 0,
    strategy_note: selected.length >= 3 ? 'Staggered 3-phase: hype → deepen → harvest' :
      selected.length === 2 ? '2-phase: ignite → convert' : 'Single streamer campaign',
  };
}
