/**
 * J-Clarity Incrementality Engine
 *
 * Moves beyond ROI to measure TRUE incremental impact:
 * "What would NOT have happened without this streamer?"
 *
 * Incrementality = Actual(t) - Baseline(t | trend, seasonality)
 *
 * Three levels:
 * Lv1: Pre-Post comparison (simple, always available)
 * Lv2: Baseline-adjusted (removes natural growth trend)
 * Lv3: Multi-factor (removes weekday effect + concurrent streamers)
 */

export interface DailyReviewData {
  date: string;        // YYYY-MM-DD
  timestamp: number;   // unix
  total: number;       // reviews that day
  up: number;
  down: number;
}

export interface BroadcastEvent {
  date: string;
  view_count: number;
  title: string;
  url: string;
}

export interface IncrementalityResult {
  // Level 1: Pre-Post
  pre_avg_7d: number;           // avg daily reviews 7 days before
  post_avg_48h: number;         // avg daily reviews 48h after
  lift_ratio: number;           // post / pre (1.0 = no effect, 2.0 = doubled)
  lift_label: string;           // "4.2× spike above baseline"

  // Level 2: Baseline-adjusted
  baseline_estimate: number;    // what we'd expect without the broadcast
  actual_post: number;          // what actually happened
  incremental_reviews: number;  // actual - baseline
  incremental_low: number;      // 95% confidence interval lower
  incremental_high: number;     // 95% confidence interval upper
  confidence: 'high' | 'medium' | 'low';  // based on data quality

  // Level 3: Context
  weekday_factor: number;       // 1.0 = normal, 1.2 = weekend boost
  concurrent_streamers: number; // other streamers broadcasting same game
  adjusted_attribution: number; // incremental / concurrent_streamers

  // Lag analysis
  lag_type: 'impulse' | 'same_day' | 'slow_burn' | 'unknown';
  lag_hours: number | null;
  lag_label: string;

  // Strategic insight
  best_use: string;             // "Pre-sale hype driver" | "Launch day anchor" etc.
  confidence_band: string;      // "35–50 incremental reviews (95% CI)"
  vs_baseline_label: string;    // "2.8× above baseline even after removing weekend effect"
}

export function calcIncrementality(
  reviewTimeline: DailyReviewData[],
  broadcast: BroadcastEvent,
  concurrentStreamers = 1
): IncrementalityResult {
  if (reviewTimeline.length < 7) {
    return nullResult(broadcast.url);
  }

  const broadcastDate = new Date(broadcast.date);
  const broadcastDateStr = broadcastDate.toISOString().split('T')[0];

  // Find broadcast position in timeline
  const broadcastIdx = reviewTimeline.findIndex(d => d.date === broadcastDateStr);

  // Pre-window: 7 days before broadcast
  const preWindow = broadcastIdx >= 7
    ? reviewTimeline.slice(broadcastIdx - 7, broadcastIdx)
    : reviewTimeline.slice(0, Math.max(broadcastIdx, 1));

  // Post-window: 2 days after
  const postWindow = reviewTimeline.slice(
    broadcastIdx + 1,
    Math.min(broadcastIdx + 3, reviewTimeline.length)
  );

  if (preWindow.length === 0) return nullResult(broadcast.url);

  // Level 1: Pre-Post
  const preAvg = preWindow.reduce((s, d) => s + d.total, 0) / preWindow.length;
  const postAvg = postWindow.length > 0
    ? postWindow.reduce((s, d) => s + d.total, 0) / postWindow.length
    : 0;
  const liftRatio = preAvg > 0 ? Math.round((postAvg / preAvg) * 100) / 100 : 0;

  // Level 2: Trend-adjusted baseline
  // Simple linear trend from pre-window
  const preTotals = preWindow.map(d => d.total);
  const trendSlope = preTotals.length >= 3
    ? (preTotals[preTotals.length - 1] - preTotals[0]) / (preTotals.length - 1)
    : 0;
  const baselineEstimate = preAvg + trendSlope; // next day estimate without broadcast

  const actualPost = postWindow.length > 0 ? postWindow[0].total : 0;
  const incrementalReviews = Math.max(0, Math.round(actualPost - baselineEstimate));

  // Confidence interval (±30% for low data, ±15% for rich data)
  const ciWidth = preWindow.length >= 7 ? 0.15 : 0.30;
  const incrementalLow = Math.max(0, Math.round(incrementalReviews * (1 - ciWidth)));
  const incrementalHigh = Math.round(incrementalReviews * (1 + ciWidth));

  // Confidence level
  const confidence: IncrementalityResult['confidence'] =
    preWindow.length >= 7 && postWindow.length >= 2 ? 'high' :
    preWindow.length >= 3 ? 'medium' : 'low';

  // Level 3: Weekday factor
  const dow = broadcastDate.getDay(); // 0=Sun, 6=Sat
  const weekdayFactor = (dow === 0 || dow === 6) ? 1.25 : 1.0;
  const adjustedIncremental = Math.round(incrementalReviews / weekdayFactor);

  // Attribution per concurrent streamer
  const adjustedAttribution = concurrentStreamers > 1
    ? Math.round(adjustedIncremental / concurrentStreamers)
    : adjustedIncremental;

  // Lag analysis
  let lagType: IncrementalityResult['lag_type'] = 'unknown';
  let lagHours: number | null = null;

  if (postWindow.length >= 2) {
    const day0 = postWindow[0]?.total || 0;
    const day1 = postWindow[1]?.total || 0;
    const baselineDay0 = baselineEstimate;
    const baselineDay1 = baselineEstimate + trendSlope;

    if (day0 - baselineDay0 > day1 - baselineDay1 && day0 > baselineDay0) {
      lagType = 'impulse';
      lagHours = 0;
    } else if (day1 - baselineDay1 > day0 - baselineDay0 && day1 > baselineDay1) {
      lagType = 'slow_burn';
      lagHours = 24;
    } else if (day0 > baselineDay0) {
      lagType = 'same_day';
      lagHours = 12;
    }
  }

  const lagLabel =
    lagType === 'impulse' ? '⚡ Impulse driver — viewers buy within hours of watching' :
    lagType === 'same_day' ? '📅 Same-day converter — purchase decision happens day-of' :
    lagType === 'slow_burn' ? '🌊 Slow burn — drives wishlists, converts on sale/update' :
    '❓ Insufficient data to determine lag pattern';

  // Strategic use case
  const bestUse =
    lagType === 'slow_burn'
      ? '🗓️ Use 1 week BEFORE a sale — they build wishlists, you harvest on discount day'
      : lagType === 'impulse'
      ? '🚀 Use on LAUNCH DAY — maximum impulse conversion within 24h'
      : lagType === 'same_day'
      ? '📌 Use during peak sales periods — same-day conversions are reliable'
      : '🧪 Run a test campaign to determine optimal timing';

  return {
    pre_avg_7d: Math.round(preAvg),
    post_avg_48h: Math.round(postAvg),
    lift_ratio: liftRatio,
    lift_label: liftRatio > 1
      ? `${liftRatio.toFixed(1)}× above pre-broadcast baseline`
      : 'No measurable lift detected',
    baseline_estimate: Math.round(baselineEstimate),
    actual_post: actualPost,
    incremental_reviews: incrementalReviews,
    incremental_low: incrementalLow,
    incremental_high: incrementalHigh,
    confidence,
    weekday_factor: weekdayFactor,
    concurrent_streamers: concurrentStreamers,
    adjusted_attribution: adjustedAttribution,
    lag_type: lagType,
    lag_hours: lagHours,
    lag_label: lagLabel,
    best_use: bestUse,
    confidence_band: incrementalReviews > 0
      ? `+${incrementalLow}–${incrementalHigh} incremental reviews (95% CI, ${confidence} confidence)`
      : 'No significant incremental effect detected',
    vs_baseline_label: weekdayFactor > 1
      ? `+${adjustedAttribution} reviews after removing weekend effect${concurrentStreamers > 1 ? ` (÷${concurrentStreamers} concurrent streamers)` : ''}`
      : `+${incrementalReviews} reviews above trend baseline${concurrentStreamers > 1 ? ` (÷${concurrentStreamers} concurrent streamers)` : ''}`,
  };
}

function nullResult(url: string): IncrementalityResult {
  return {
    pre_avg_7d: 0, post_avg_48h: 0, lift_ratio: 0,
    lift_label: 'Insufficient data',
    baseline_estimate: 0, actual_post: 0,
    incremental_reviews: 0, incremental_low: 0, incremental_high: 0,
    confidence: 'low',
    weekday_factor: 1.0, concurrent_streamers: 1, adjusted_attribution: 0,
    lag_type: 'unknown', lag_hours: null,
    lag_label: '❓ No data available',
    best_use: '🧪 Run a test campaign to generate baseline data',
    confidence_band: 'Insufficient data for analysis',
    vs_baseline_label: '—',
  };
}

/**
 * Aggregate incrementality across multiple broadcasts for a streamer
 */
export function aggregateIncrementality(results: IncrementalityResult[]): {
  avg_incremental: number;
  avg_lift_ratio: number;
  confidence_band: string;
  dominant_lag: string;
  best_use: string;
  sample_size: number;
} {
  const valid = results.filter(r => r.incremental_reviews > 0);
  if (valid.length === 0) {
    return {
      avg_incremental: 0, avg_lift_ratio: 0,
      confidence_band: 'No conversion data yet',
      dominant_lag: 'unknown', best_use: '🧪 Test campaign needed',
      sample_size: 0,
    };
  }

  const avgIncremental = Math.round(valid.reduce((s, r) => s + r.incremental_reviews, 0) / valid.length);
  const avgLift = Math.round(valid.reduce((s, r) => s + r.lift_ratio, 0) / valid.length * 10) / 10;
  const low = Math.round(avgIncremental * 0.7);
  const high = Math.round(avgIncremental * 1.4);

  // Dominant lag type
  const lagCounts = { impulse: 0, same_day: 0, slow_burn: 0, unknown: 0 };
  valid.forEach(r => lagCounts[r.lag_type]++);
  const dominantLag = Object.entries(lagCounts).sort(([, a], [, b]) => b - a)[0][0];

  const bestUse = valid[0]?.best_use || '🧪 Test campaign needed';

  return {
    avg_incremental: avgIncremental,
    avg_lift_ratio: avgLift,
    confidence_band: `+${low}–${high} reviews per stream (avg across ${valid.length} broadcasts)`,
    dominant_lag: dominantLag,
    best_use: bestUse,
    sample_size: valid.length,
  };
}
