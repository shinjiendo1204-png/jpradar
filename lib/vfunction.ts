/**
 * J-Clarity V-Function: Purchasing Power Model
 *
 * V = (R+1)^α × (E+1)^β × (C+ε)^γ × Fit^δ
 *
 * R = Reach (avg viewers)
 * E = Engagement (clips per broadcast as proxy)
 * C = Conversion (steam review delta correlated with broadcast)
 * Fit = Genre match score (0-1)
 */

export interface VFunctionInput {
  avg_view_count: number;        // R: reach
  clips_per_broadcast: number;   // E: engagement proxy
  review_delta_per_stream: number; // C: conversion evidence
  genre_fit: number;             // Fit: 0.0 - 1.0
  peak_hour_bonus: number;       // Time: 0.8 - 1.2
}

export interface VFunctionOutput {
  v_score: number;               // Final V score (0-100)
  reach_component: number;
  engagement_component: number;
  conversion_component: number;
  fit_component: number;
  tier: 'S' | 'A' | 'B' | 'C';
  estimated_purchases_per_stream: { low: number; mid: number; high: number };
  cbi_index: number;             // Chat Buy-Intent Index (0-100)
  interpretation: string;
}

// Exponents (tunable based on data)
const ALPHA = 0.35; // reach: diminishing returns on large audiences
const BETA  = 0.45; // engagement: high weight - engaged chat = buyers
const GAMMA = 0.60; // conversion: highest weight - actual evidence
const DELTA = 0.30; // genre fit: moderate weight

export function calcVFunction(input: VFunctionInput): VFunctionOutput {
  const { avg_view_count, clips_per_broadcast, review_delta_per_stream, genre_fit, peak_hour_bonus } = input;

  /**
   * Additive scoring model (0-100)
   * J-Clarity value prop: a small streamer with high conversion
   * can outrank a mega-streamer with zero conversion.
   *
   * Reach      (0-25): log scale — large audiences matter but have diminishing returns
   * Engagement (0-25): clips/interaction per stream relative to audience
   * Conversion (0-35): most important — actual Steam review delta evidence
   * Fit        (0-15): genre alignment
   */

  // Reach: log10(viewers) * 7, capped at 25
  // 100 viewers → 14,  1k → 21,  10k → 28→cap25,  100k → 35→cap25
  const reachComp = Math.min(Math.log10(avg_view_count + 1) * 7, 25);

  // Engagement: clips relative to audience size (high rate = more engaged chat)
  // 1 clip per 1k viewers = 10pts, scales up to 25
  const engagementRate = avg_view_count > 0
    ? (clips_per_broadcast / Math.max(avg_view_count / 1000, 0.1))
    : 0;
  const engageComp = Math.min(engagementRate * 10, 25);

  // Conversion: actual evidence of purchase behavior (review delta)
  // 1 review delta per stream = 5pts, scales to 35
  const convertComp = Math.min(review_delta_per_stream * 5, 35);

  // Fit: genre alignment
  const fitComp = Math.min(genre_fit * 15, 15);

  const rawScore = reachComp + engageComp + convertComp + fitComp;
  const timeAdjusted = rawScore * peak_hour_bonus;
  const v_score = Math.min(Math.round(timeAdjusted), 100);

  // CBI: Chat Buy-Intent Index — conversion efficiency relative to reach
  const conversionRate = avg_view_count > 0
    ? review_delta_per_stream / (avg_view_count / 1000)
    : 0;
  const cbi_index = Math.min(Math.round(
    Math.min(engagementRate * 30, 50) +
    Math.min(conversionRate * 50, 50)
  ), 100);

  // Tier
  const tier: VFunctionOutput['tier'] =
    v_score >= 65 ? 'S' :
    v_score >= 45 ? 'A' :
    v_score >= 25 ? 'B' : 'C';

  // Estimated purchases per stream
  // Base: avg_view_count × conversion_rate
  // Conversion rates: S=1.5%, A=0.8%, B=0.4%, C=0.2%
  const convRate = tier === 'S' ? 0.015 : tier === 'A' ? 0.008 : tier === 'B' ? 0.004 : 0.002;
  const midPurchases = Math.round(avg_view_count * convRate);

  const interpretation =
    tier === 'S' ? 'Exceptional converter. High chat engagement translates directly to purchases.' :
    tier === 'A' ? 'Strong performer. Good genre fit with meaningful conversion evidence.' :
    tier === 'B' ? 'Average converter. Consider for broad awareness campaigns.' :
    'Low conversion evidence. May not justify sponsorship cost for direct sales.';

  return {
    v_score,
    reach_component: Math.round(reachComp * 10) / 10,
    engagement_component: Math.round(engageComp * 10) / 10,
    conversion_component: Math.round(convertComp * 10) / 10,
    fit_component: Math.round(fitComp * 10) / 10,
    tier,
    estimated_purchases_per_stream: {
      low: Math.max(0, Math.round(midPurchases * 0.5)),
      mid: midPurchases,
      high: Math.round(midPurchases * 2),
    },
    cbi_index,
    interpretation,
  };
}

/**
 * CBI: Chat Buy-Intent Index categories
 */
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

  return {
    cbi_score: cbiScore,
    strong_count: strongCount,
    mid_count: midCount,
    weak_count: weakCount,
    total_buy_signals: strongCount + midCount + weakCount,
  };
}

/**
 * Budget Optimizer: find optimal streamer combination for a given budget
 */
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

export function optimizeBudget(
  streamers: StreamerForOptimizer[],
  budget_jpy: number
): OptimizedPortfolio {
  // Strategy: Day 1 = High CBI (fire starter), Day 4 = High Fit (deep dive), Day 7 = High Reach (harvest)
  const sorted = [...streamers].sort((a, b) => b.v_score - a.v_score);

  const selected: (StreamerForOptimizer & { role: string; day: number })[] = [];
  let remaining = budget_jpy;

  // Phase 1: Fire starter - highest V-score that fits budget
  const fireStarter = sorted.find(s => s.estimated_cost_jpy <= remaining * 0.4 && s.tier !== 'C');
  if (fireStarter) {
    selected.push({ ...fireStarter, role: '🔥 Fire Starter', day: 1 });
    remaining -= fireStarter.estimated_cost_jpy;
  }

  // Phase 2: Deep dive - best genre fit
  const deepDive = sorted.find(s =>
    s.genre_fit &&
    s.estimated_cost_jpy <= remaining * 0.5 &&
    s.username !== fireStarter?.username
  );
  if (deepDive) {
    selected.push({ ...deepDive, role: '🎮 Genre Expert', day: 4 });
    remaining -= deepDive.estimated_cost_jpy;
  }

  // Phase 3: Harvest - highest reach within remaining budget
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
  const cpp = totalMid > 0 ? Math.round(totalCost / totalMid) : 0;

  return {
    selected_streamers: selected,
    total_cost_jpy: totalCost,
    total_estimated_purchases: {
      low: Math.round(totalMid * 0.5),
      mid: totalMid,
      high: Math.round(totalMid * 2),
    },
    cost_per_purchase_jpy: cpp,
    strategy_note: selected.length >= 3
      ? 'Staggered 3-phase campaign: build hype → deepen engagement → maximize conversions'
      : selected.length === 2
      ? '2-phase campaign: ignite interest then convert'
      : 'Single streamer campaign',
  };
}
