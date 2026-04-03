import { NextRequest, NextResponse } from 'next/server';
import { getPastBroadcasts, getStreamerInfo, getTwitchGameId } from '@/lib/twitch';

/**
 * Conversion Lag Curve
 * Shows: Steam review spikes vs broadcast dates for a game
 * GET /api/clarity/lagcurve?steam_id=xxx&game_name=xxx&streamer=xxx
 */

async function getSteamDailyData(steamId: string): Promise<{
  date: number;
  dateStr: string;
  up: number;
  down: number;
  total: number;
}[]> {
  try {
    const res = await fetch(`https://store.steampowered.com/appreviewhistogram/${steamId}?json=1`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results?.recent || []).map((r: any) => ({
      date: r.date,
      dateStr: new Date(r.date * 1000).toISOString().split('T')[0],
      up: r.recommendations_up || 0,
      down: r.recommendations_down || 0,
      total: (r.recommendations_up || 0) + (r.recommendations_down || 0),
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const steamId = req.nextUrl.searchParams.get('steam_id');
  const gameName = req.nextUrl.searchParams.get('game_name') || '';
  const streamerUsername = req.nextUrl.searchParams.get('streamer') || '';

  if (!steamId) return NextResponse.json({ error: 'Missing steam_id' }, { status: 400 });

  try {
    // Get Steam daily review data
    const steamData = await getSteamDailyData(steamId);

    // Get streamer broadcast dates if provided
    let broadcastEvents: { date: string; title: string; view_count: number; url: string }[] = [];

    if (streamerUsername) {
      const streamer = await getStreamerInfo(streamerUsername);
      if (streamer) {
        const broadcasts = await getPastBroadcasts(streamer.id, 30);
        broadcastEvents = broadcasts.map(b => ({
          date: b.created_at.split('T')[0],
          title: b.title,
          view_count: b.view_count,
          url: `https://www.twitch.tv/videos/${b.id}`,
        }));
      }
    }

    // Find peak days (top 20% of review activity)
    const totals = steamData.map(d => d.total);
    const avgTotal = totals.reduce((s, t) => s + t, 0) / (totals.length || 1);
    const peakThreshold = avgTotal * 1.5;

    const peakDays = steamData
      .filter(d => d.total >= peakThreshold)
      .map(d => d.dateStr);

    // Track attributed dates to avoid double counting across overlapping broadcasts
    const attributedDates = new Set<string>();
    const baselineReviews = avgTotal;

    const broadcastImpacts = broadcastEvents.map(b => {
      const broadcastDate = new Date(b.date);
      const spikeDays: any[] = [];

      for (let h = 0; h <= 48; h += 24) {
        const checkDate = new Date(broadcastDate.getTime() + h * 3600000);
        const dateStr = checkDate.toISOString().split('T')[0];
        const dayData = steamData.find(d => d.dateStr === dateStr);
        if (dayData && !attributedDates.has(dateStr)) {
          const delta = dayData.total - baselineReviews;
          if (delta > 0 && dayData.total >= peakThreshold) {
            spikeDays.push({
              dateStr,
              reviews: dayData.total,
              delta: Math.round(delta),
              hours_after: h,
            });
            attributedDates.add(dateStr); // mark as used
          }
        }
      }

      const maxDelta = spikeDays.reduce((m, s) => Math.max(m, s.delta), 0);

      return {
        broadcast_date: b.date,
        title: b.title,
        view_count: b.view_count,
        url: b.url,
        caused_spike: spikeDays.length > 0,
        spike_data: spikeDays,
        lag_hours: spikeDays.length > 0 ? spikeDays[0].hours_after : null,
        attributed_reviews: maxDelta,  // extra reviews above baseline
        attribution_rate: b.view_count > 0
          ? Math.round((maxDelta / b.view_count) * 10000) / 100  // % of viewers who reviewed
          : 0,
      };
    });

    // Determine streamer's conversion type
    const impacts = broadcastImpacts.filter(b => b.caused_spike);
    const avgLag = impacts.length > 0
      ? impacts.reduce((s, b) => s + (b.lag_hours || 0), 0) / impacts.length
      : null;

    const conversionType = avgLag === null ? 'unknown'
      : avgLag <= 6 ? 'impulse_buyer'      // < 6h: impulse purchase
      : avgLag <= 24 ? 'same_day'           // 6-24h: same day decision
      : 'delayed';                           // 24-48h: word-of-mouth / slow burn

    // Calculate avg attributed reviews per broadcast
    const impactBroadcasts = broadcastImpacts.filter(b => b.caused_spike);
    const avgAttributedReviews = impactBroadcasts.length > 0
      ? Math.round(impactBroadcasts.reduce((s, b) => s + b.attributed_reviews, 0) / impactBroadcasts.length)
      : 0;

    const avgAttributionRate = impactBroadcasts.length > 0
      ? Math.round(impactBroadcasts.reduce((s, b) => s + b.attribution_rate, 0) / impactBroadcasts.length * 100) / 100
      : 0;

    return NextResponse.json({
      steam_id: steamId,
      game_name: gameName,
      streamer: streamerUsername || null,
      review_timeline: steamData.slice(-60).map(d => ({
        date: d.dateStr,
        reviews: d.total,
        baseline: Math.round(avgTotal),
        is_peak: d.total >= peakThreshold,
      })),
      broadcast_events: broadcastEvents.slice(0, 20),
      broadcast_impacts: impactBroadcasts.slice(0, 5),
      // Summary
      avg_daily_reviews_baseline: Math.round(avgTotal),
      avg_attributed_reviews_per_stream: avgAttributedReviews,
      avg_attribution_rate_pct: avgAttributionRate,
      conversion_type: conversionType,
      conversion_type_label: conversionType === 'impulse_buyer' ? '⚡ Impulse Buyer Driver (< 6h)' :
                             conversionType === 'same_day' ? '📅 Same-Day Converter (6–24h)' :
                             conversionType === 'delayed' ? '🌊 Slow Burn / Word-of-Mouth (24–48h)' :
                             '❓ Insufficient data',
      avg_lag_hours: avgLag,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
