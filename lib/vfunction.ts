/**
 * J-Clarity V-Function v3
 *
 * Problem with v2: "Engine is Ferrari, no gas"
 * - engagement_rate always 0 → engScore always 0
 * - review_delta often 0 → conversionScore 0
 * - genre_fit always 1.0 → no differentiation
 * - avg_category_views hardcoded → reach saturates
 *
 * v3 fixes:
 * 1. Engagement: fallback to viewer-count-based estimate when no data
 * 2. Conversion: 48h window, log scale, fallback to pseudo-CBI
 * 3. Genre fit: ratio of game-related broadcasts to total
 * 4. Category avg: passed dynamically from live stream data
 * 5. Z-score normalization at the ranking level (done in API)
 */

export interface VFunctionInput {
  avg_view_count: number;
  avg_category_views?: number;       // dynamic per-category average
  review_delta_per_stream: number;   // attributed reviews (48h window)
  engagement_rate?: number;          // chat_messages / viewers, or clips/viewers
  genre_broadcast_ratio?: number;    // 0-1: fraction of streams in same genre
  peak_hour_bonus?: number;
}

export interface VFunctionOutput {
  v_score: number;
  tier: 'S' | 'A' | 'B' | 'C';
  cbi_index: number;
  interpretation: string;
  components: {
    reach_efficiency: number;   // 0-30
    conversion: number;         // 0-40
    engagement: number;         // 0-20
    fit: number;                // 0-10
  };
  estimated_purchases_per_stream: { low: number; mid: number; high: number };
}

export function calcVFunction(input: VFunctionInput): VFunctionOutput {
  const {
    avg_view_count,
    avg_category_views = 5000,
    review_delta_per_stream,
    engagement_rate,
    genre_broadcast_ratio,
    peak_hour_bonus = 1.0,
  } = input;

  // 1. Reach Efficiency (0-30)
  // Uses ratio to category average — prevents mega-streamers from all hitting max
  const reachRatio = avg_view_count / Math.max(avg_category_views, 100);
  // Smoothed: 0.5x avg=13, 1x=15, 2x=18, 5x=22, 10x=25, 50x=30
  const reachEfficiency = Math.min(
    15 + Math.log10(reachRatio + 0.5) * 12,
    30
  );

  // 2. Conversion Evidence (0-40) — most important
  // If we have real data: log scale heavily weighted
  // If no data (0): use small fallback based on viewer count (pseudo-CBI)
  let conversionScore: number;
  if (review_delta_per_stream > 0) {
    conversionScore = Math.min(Math.log10(review_delta_per_stream + 1) * 25, 40);
  } else {
    // Fallback: estimate 0.05% of viewers leave a review
    const pseudoDelta = avg_view_count * 0.0005;
    conversionScore = Math.min(Math.log10(pseudoDelta + 1) * 10, 8); // capped lower
  }

  // 3. Engagement Quality (0-20)
  // Fix: never let this be 0 — use log fallback
  let engScore: number;
  if (engagement_rate && engagement_rate > 0) {
    // High-quality: engagement rate > 0.01 = very engaged chat
    engScore = Math.min(Math.log10(engagement_rate * 100 + 1) * 10, 20);
  } else {
    // Fallback: estimate from viewer count
    // Smaller streamers tend to have higher engagement rates
    const estimatedEngRate = avg_view_count < 1000 ? 0.05
      : avg_view_count < 10000 ? 0.02
      : avg_view_count < 100000 ? 0.01
      : 0.005;
    engScore = Math.min(Math.log10(estimatedEngRate * 100 + 1) * 10, 20);
  }

  // 4. Genre Fit (0-10)
  // Use ratio of game-related broadcasts to total, not just binary
  let fitScore: number;
  if (genre_broadcast_ratio !== undefined) {
    fitScore = Math.min(genre_broadcast_ratio * 10, 10);
  } else {
    fitScore = 4; // neutral default (not 0 or 10)
  }

  const rawScore = (reachEfficiency + conversionScore + engScore + fitScore) * peak_hour_bonus;
  const v_score = Math.max(0, Math.min(Math.round(rawScore), 100));

  // Tier
  const tier: VFunctionOutput['tier'] =
    v_score >= 62 ? 'S' :
    v_score >= 45 ? 'A' :
    v_score >= 28 ? 'B' : 'C';

  // CBI: conversion rate proxy
  const convRate = avg_view_count > 0
    ? review_delta_per_stream / avg_view_count
    : 0;
  const cbi_index = Math.min(Math.round(
    review_delta_per_stream > 0
      ? Math.log10(convRate * 1000 + 1) * 40
      : engScore * 2  // fallback from engagement
  ), 100);

  // Purchase estimate
  const baseRate = tier === 'S' ? 0.015 : tier === 'A' ? 0.008 : tier === 'B' ? 0.004 : 0.002;
  const evidenceRate = avg_view_count > 0 && review_delta_per_stream > 0
    ? review_delta_per_stream / avg_view_count
    : 0;
  const effectiveRate = evidenceRate > 0 ? (baseRate + evidenceRate) / 2 : baseRate;
  const midPurchases = Math.round(avg_view_count * effectiveRate);

  const interpretation =
    v_score >= 62 ? `Top-tier converter. ${review_delta_per_stream > 0 ? `${review_delta_per_stream} attributed reviews/stream.` : 'Strong reach efficiency.'}` :
    v_score >= 45 ? 'High performer. Good balance of reach and engagement.' :
    v_score >= 28 ? `Average performer. ${review_delta_per_stream === 0 ? 'No conversion data yet — run a test stream.' : 'Moderate conversion signal.'}` :
    'Low signal. Consider for brand awareness only.';

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
  mid_intent:    { keywords: ['欲しい', '気になる', 'want', 'interested', '買おうかな'], weight: 1.5 },
  weak_intent:   { keywords: ['面白そう', '神ゲー', 'looks fun', 'いいな', 'やってみたい'], weight: 0.5 },
};

export function calcCBIFromComments(comments: string[]): {
  cbi_score: number; strong_count: number; mid_count: number; weak_count: number; total_buy_signals: number;
} {
  let s = 0, m = 0, w = 0;
  for (const c of comments) {
    const l = c.toLowerCase();
    if (CBI_WEIGHTS.strong_intent.keywords.some(k => l.includes(k))) s++;
    else if (CBI_WEIGHTS.mid_intent.keywords.some(k => l.includes(k))) m++;
    else if (CBI_WEIGHTS.weak_intent.keywords.some(k => l.includes(k))) w++;
  }
  const total = s * 3 + m * 1.5 + w * 0.5;
  return {
    cbi_score: comments.length >= 50 ? Math.min(Math.round((total / comments.length) * 1000), 100) : Math.round(total * 5),
    strong_count: s, mid_count: m, weak_count: w, total_buy_signals: s + m + w,
  };
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

export function optimizeBudget(streamers: StreamerForOptimizer[], budget_jpy: number) {
  const sorted = [...streamers].sort((a, b) => b.v_score - a.v_score);
  const selected: (StreamerForOptimizer & { role: string; day: number })[] = [];
  let remaining = budget_jpy;

  const fireStarter = sorted.find(s => s.estimated_cost_jpy <= remaining * 0.4 && s.tier !== 'C');
  if (fireStarter) { selected.push({ ...fireStarter, role: '🔥 Fire Starter', day: 1 }); remaining -= fireStarter.estimated_cost_jpy; }

  const deepDive = sorted.find(s => s.genre_fit && s.estimated_cost_jpy <= remaining * 0.5 && s.username !== fireStarter?.username);
  if (deepDive) { selected.push({ ...deepDive, role: '🎮 Genre Expert', day: 4 }); remaining -= deepDive.estimated_cost_jpy; }

  const harvest = sorted
    .filter(s => s.username !== fireStarter?.username && s.username !== deepDive?.username)
    .sort((a, b) => b.avg_view_count - a.avg_view_count)
    .find(s => s.estimated_cost_jpy <= remaining);
  if (harvest) { selected.push({ ...harvest, role: '📈 Amplifier', day: 7 }); remaining -= harvest.estimated_cost_jpy; }

  const totalCost = budget_jpy - remaining;
  const totalMid = selected.reduce((s, st) => s + st.estimated_purchases_mid, 0);
  return {
    selected_streamers: selected,
    total_cost_jpy: totalCost,
    total_estimated_purchases: { low: Math.round(totalMid * 0.5), mid: totalMid, high: Math.round(totalMid * 2) },
    cost_per_purchase_jpy: totalMid > 0 ? Math.round(totalCost / totalMid) : 0,
    strategy_note: selected.length >= 3 ? 'Staggered 3-phase: hype → deepen → harvest' :
      selected.length === 2 ? '2-phase: ignite → convert' : 'Single streamer campaign',
  };
}
