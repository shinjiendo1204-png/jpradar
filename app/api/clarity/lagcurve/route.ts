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

    // For each broadcast, check if there's a review spike within 48h
    const broadcastImpacts = broadcastEvents.map(b => {
      const broadcastDate = new Date(b.date);
      const spikeDays = [];
      for (let h = 0; h <= 48; h += 24) {
        const checkDate = new Date(broadcastDate.getTime() + h * 3600000);
        const dateStr = checkDate.toISOString().split('T')[0];
        const dayData = steamData.find(d => d.dateStr === dateStr);
        if (dayData && dayData.total >= peakThreshold) {
          spikeDays.push({ dateStr, reviews: dayData.total, hours_after: h });
        }
      }
      return {
        broadcast_date: b.date,
        title: b.title,
        view_count: b.view_count,
        url: b.url,
        caused_spike: spikeDays.length > 0,
        spike_data: spikeDays,
        lag_hours: spikeDays.length > 0 ? spikeDays[0].hours_after : null,
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

    return NextResponse.json({
      steam_id: steamId,
      game_name: gameName,
      streamer: streamerUsername || null,
      // Chart data: daily reviews for last 60 days
      review_timeline: steamData.slice(-60).map(d => ({
        date: d.dateStr,
        reviews: d.total,
        is_peak: d.total >= peakThreshold,
      })),
      // Broadcast markers
      broadcast_events: broadcastEvents.slice(0, 20),
      // Impact analysis
      broadcast_impacts: broadcastImpacts.filter(b => b.caused_spike).slice(0, 5),
      peak_days: peakDays.slice(-30),
      avg_daily_reviews: Math.round(avgTotal),
      peak_threshold: Math.round(peakThreshold),
      // Conversion type
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
