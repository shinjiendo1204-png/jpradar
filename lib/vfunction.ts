/**
 * J-Clarity V-Function v4
 *
 * Core philosophy: "売れる人は量じゃなく効率で測る"
 *
 * All metrics are RATE-based (density), not absolute:
 * - Reach: percentile within category (not absolute viewers)
 * - Engagement: chat_rate = interactions / viewers (log scaled)
 * - Conversion: conv_rate = review_delta / viewers (log scaled)
 * - Fit: fraction of broadcasts in same genre
 */

export interface VFunctionInput {
  avg_view_count: number;
  category_percentile?: number;      // 0-100: where this streamer ranks in category
  review_delta_per_stream: number;   // attributed reviews (48h window)
  engagement_rate?: number;          // interactions / viewers (e.g. 0.02 = 2%)
  genre_broadcast_ratio?: number;    // 0-1: fraction of streams in same genre
  peak_hour_bonus?: number;
}

export interface VFunctionOutput {
  v_score: number;
  tier: 'S' | 'A' | 'B' | 'C';
  cbi_index: number;
  interpretation: string;
  components: {
    reach_efficiency: number;   // 0-25
    conversion: number;         // 0-40
    engagement: number;         // 0-25
    fit: number;                // 0-10
  };
  estimated_purchases_per_stream: { low: number; mid: number; high: number };
}

export function calcVFunction(input: VFunctionInput): VFunctionOutput {
  const {
    avg_view_count,
    category_percentile,
    review_delta_per_stream,
    engagement_rate,
    genre_broadcast_ratio,
    peak_hour_bonus = 1.0,
  } = input;

  // 1. Reach Efficiency (0-25): percentile-based
  // Top 10% = 22-25, top 25% = 17-21, median = 12-13, bottom 25% = 5-8
  let reachEfficiency: number;
  if (category_percentile !== undefined) {
    reachEfficiency = Math.round((category_percentile / 100) * 25);
  } else {
    // Fallback: log estimate without category context
    reachEfficiency = Math.min(Math.log10(avg_view_count + 1) * 4, 25);
  }

  // 2. Conversion (0-40): RATE-based, not absolute
  // conv_rate = reviews / viewers
  // 0.001% (1/100k) = low, 0.01% (1/10k) = medium, 0.1% (1/1k) = high, 1% = exceptional
  let conversionScore: number;
  if (review_delta_per_stream > 0 && avg_view_count > 0) {
    const convRate = review_delta_per_stream / avg_view_count;
    conversionScore = Math.min(Math.log10(convRate * 10000 + 1) * 15, 40);
  } else {
    // No data fallback: 3 points (vs 0 — don't punish for missing data)
    conversionScore = 3;
  }

  // 3. Engagement (0-25): chat rate log-scaled
  // 0.001 = 0.1% → low, 0.01 = 1% → medium, 0.05 = 5% → high, 0.1+ = exceptional
  let engScore: number;
  if (engagement_rate && engagement_rate > 0) {
    engScore = Math.min(Math.log10(engagement_rate * 100 + 1) * 12, 25);
  } else {
    // Estimate by size: smaller streamers have higher engagement rates
    const estimated = avg_view_count < 500 ? 0.08
      : avg_view_count < 2000 ? 0.04
      : avg_view_count < 10000 ? 0.02
      : avg_view_count < 50000 ? 0.012
      : 0.007;
    engScore = Math.min(Math.log10(estimated * 100 + 1) * 12, 25);
  }

  // 4. Genre Fit (0-10)
  const fitScore = genre_broadcast_ratio !== undefined
    ? Math.min(genre_broadcast_ratio * 10, 10)
    : 3; // neutral default

  const rawScore = (reachEfficiency + conversionScore + engScore + fitScore) * peak_hour_bonus;
  const v_score = Math.max(0, Math.min(Math.round(rawScore), 100));

  // Tier
  const tier: VFunctionOutput['tier'] =
    v_score >= 65 ? 'S' :
    v_score >= 48 ? 'A' :
    v_score >= 30 ? 'B' : 'C';

  // CBI: composite of conversion rate + engagement rate
  const convRate = avg_view_count > 0 ? review_delta_per_stream / avg_view_count : 0;
  const engRate = engagement_rate || 0.01;
  const cbi_index = Math.min(Math.round(
    Math.log10(convRate * 5000 + 1) * 35 +
    Math.log10(engRate * 100 + 1) * 10
  ), 100);

  // Purchase estimate: rate-based
  // If we have real data, use it weighted with tier base rate
  const tierBaseRate = tier === 'S' ? 0.012 : tier === 'A' ? 0.007 : tier === 'B' ? 0.003 : 0.001;
  const evidenceRate = convRate > 0 ? convRate : 0;
  const effectiveRate = evidenceRate > 0 ? (tierBaseRate + evidenceRate) / 2 : tierBaseRate;
  const midPurchases = Math.round(avg_view_count * effectiveRate);

  const interpretation =
    v_score >= 65 ? `Top converter. ${review_delta_per_stream > 0 ? `${(convRate * 10000).toFixed(1)}x per 10k viewers.` : 'Strong reach + engagement.'}` :
    v_score >= 48 ? 'Good performer. Solid conversion efficiency.' :
    v_score >= 30 ? (review_delta_per_stream === 0 ? 'No conversion data yet. Test with a small campaign first.' : 'Moderate efficiency.') :
    'Low signal. Consider for awareness only.';

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

// Compute percentile ranks for a list of streamers
export function assignPercentiles(viewers: number[]): number[] {
  const sorted = [...viewers].sort((a, b) => a - b);
  return viewers.map(v => {
    const rank = sorted.filter(x => x <= v).length;
    return Math.round((rank / sorted.length) * 100);
  });
}

export const CBI_WEIGHTS = {
  strong_intent: { keywords: ['買った', '購入', 'bought', 'purchased', '落とした', 'buy'], weight: 3.0 },
  mid_intent:    { keywords: ['欲しい', '気になる', 'want', 'interested', '買おうかな'], weight: 1.5 },
  weak_intent:   { keywords: ['面白そう', '神ゲー', 'looks fun', 'いいな', 'やってみたい'], weight: 0.5 },
};

export function calcCBIFromComments(comments: string[]) {
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
    strategy_note: selected.length >= 3 ? '3-phase: hype → deepen → harvest' :
      selected.length === 2 ? '2-phase: ignite → convert' : 'Single streamer campaign',
  };
}
