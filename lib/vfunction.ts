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

  // Normalize inputs to 0-100 scale before applying
  const R = Math.min(avg_view_count / 1000, 100);           // 1000 viewers = 1.0 unit
  const E = Math.min(clips_per_broadcast * 10, 100);         // 1 clip per stream = 10 units
  const C = Math.min(review_delta_per_stream * 5, 100);      // 1 review per stream = 5 units
  const Fit = Math.max(0, Math.min(genre_fit, 1));

  const reachComp      = Math.pow(R + 1, ALPHA);
  const engageComp     = Math.pow(E + 1, BETA);
  const convertComp    = Math.pow(C + 0.1, GAMMA);  // ε = 0.1 to avoid zero
  const fitComp        = Math.pow(Fit * 10 + 1, DELTA);
  const timeBonus      = peak_hour_bonus;

  const rawScore = reachComp * engageComp * convertComp * fitComp * timeBonus;

  // Normalize: log scale to prevent saturation
  // At typical values (10k viewers, some engagement, some conversion): rawScore ~5-15
  // At very high values (100k viewers): rawScore ~20-30
  // Map to 0-100 with log curve
  const v_score = Math.min(Math.round(Math.log10(rawScore + 1) * 55), 100);

  // CBI: Chat Buy-Intent Index
  // Higher engagement relative to viewers = higher buying intent
  const engagementRate = avg_view_count > 0 ? clips_per_broadcast / (avg_view_count / 1000) : 0;
  const conversionRate = avg_view_count > 0 ? review_delta_per_stream / (avg_view_count / 1000) : 0;
  const cbi_index = Math.min(Math.round((engagementRate * 40 + conversionRate * 60)), 100);

  // Tier — calibrated for log-normalized score
  const tier: VFunctionOutput['tier'] =
    v_score >= 65 ? 'S' :
    v_score >= 48 ? 'A' :
    v_score >= 32 ? 'B' : 'C';

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
