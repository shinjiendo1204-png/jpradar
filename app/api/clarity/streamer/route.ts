import { NextRequest, NextResponse } from 'next/server';
import { getStreamerInfo, getPastBroadcasts } from '@/lib/twitch';
import { calcVFunction, assignPercentiles } from '@/lib/vfunction';

/**
 * J-Clarity Streamer Analysis
 *
 * Key fix: Twitch VOD view_count = total replay views (not live viewers).
 * We use current live viewer_count from the ranking API, or fall back to
 * estimating from VOD data with a correction factor.
 */

function parseDurationToMinutes(duration: string): number {
  const h = parseInt(duration.match(/(\d+)h/)?.[1] || '0');
  const m = parseInt(duration.match(/(\d+)m/)?.[1] || '0');
  return h * 60 + m;
}

async function getSteamDailyReviews(steamId: string): Promise<{ date: number; up: number; down: number }[]> {
  try {
    const res = await fetch(`https://store.steampowered.com/appreviewhistogram/${steamId}?json=1`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results?.recent || []).map((r: any) => ({
      date: r.date,
      up: r.recommendations_up || 0,
      down: r.recommendations_down || 0,
    }));
  } catch {
    return [];
  }
}

const GENRE_MAP: Record<string, string[]> = {
  'FPS / Shooter':    ['counter-strike', 'valorant', 'overwatch', 'apex', 'call of duty', 'battlefield'],
  'Survival':         ['valheim', 'rust', 'ark', 'dayz', 'subnautica'],
  'RPG / JRPG':       ['final fantasy', 'dragon quest', 'elden ring', 'persona', 'monster hunter'],
  'Battle Royale':    ['pubg', 'fortnite', 'warzone', 'battlegrounds'],
  'Horror':           ['resident evil', 'silent hill', 'phasmophobia', 'dead by daylight'],
  'Card / Strategy':  ['hearthstone', 'shadowverse', 'slay the spire', 'civilization'],
  'Just Chatting':    ['just chatting', '雑談', 'zatsudan'],
  'Sports / Racing':  ['fifa', 'pes', 'nba', 'gran turismo', 'f1'],
};

function detectGenresFromTitles(titles: string[]): { genre: string; count: number; ratio: number }[] {
  const text = titles.join(' ').toLowerCase();
  const total = titles.length || 1;
  return Object.entries(GENRE_MAP)
    .map(([genre, kws]) => {
      const count = titles.filter(t => kws.some(k => t.toLowerCase().includes(k))).length;
      return { genre, count, ratio: Math.round((count / total) * 100) };
    })
    .filter(g => g.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  const steamId = req.nextUrl.searchParams.get('steam_id');
  const gameName = req.nextUrl.searchParams.get('game_name') || '';
  // live_viewer_count: passed from ranking page (accurate live number)
  const liveViewers = parseInt(req.nextUrl.searchParams.get('live_viewers') || '0');

  if (!username) return NextResponse.json({ error: 'Missing ?username=' }, { status: 400 });

  try {
    const normalizedUsername = username.toLowerCase();

    const [streamer, steamDaily] = await Promise.all([
      getStreamerInfo(normalizedUsername),
      steamId ? getSteamDailyReviews(steamId) : Promise.resolve([]),
    ]);

    if (!streamer) {
      return NextResponse.json({ error: `Streamer "${username}" not found on Twitch` }, { status: 404 });
    }

    // Get past broadcasts — fetch 50 to cover up to 6 months
    const broadcasts = await getPastBroadcasts(streamer.id, 50);

    // Period param: 7d, 30d, 180d
    const period = req.nextUrl.searchParams.get('period') || '30d';
    const periodDays = period === '7d' ? 7 : period === '180d' ? 180 : 30;
    const cutoff = new Date(Date.now() - periodDays * 24 * 3600000);
    const recentBroadcasts = broadcasts.filter(b => new Date(b.created_at) >= cutoff);

    // NOTE: Twitch VOD view_count = total replay views, NOT live concurrent viewers.
    // To get avg concurrent viewers:
    // Option A: use live_viewers param (passed from ranking when streamer is live)
    // Option B: estimate from VOD views with ~3% live ratio for large streamers
    // We use Option A if available, else Option B
    const estimateAvgConcurrent = (vodViewCount: number): number => {
      // VOD replay ratio: ~2-5% of total VOD views happened live
      // Conservative: 3%
      return Math.round(vodViewCount * 0.03);
    };

    const avgConcurrentFromVODs = recentBroadcasts.length > 0
      ? Math.round(recentBroadcasts.reduce((s, b) => s + estimateAvgConcurrent(b.view_count), 0) / recentBroadcasts.length)
      : 0;

    // Prefer live viewer data (accurate) over VOD estimate
    const avgViewCount = liveViewers > 0 ? liveViewers : avgConcurrentFromVODs;
    const peakViewCount = liveViewers > 0
      ? Math.round(liveViewers * 1.5) // estimate peak as 1.5x current
      : Math.round(Math.max(...recentBroadcasts.map(b => estimateAvgConcurrent(b.view_count)), 0));

    // Streaming frequency
    const totalMinutes = recentBroadcasts.reduce((s, b) => s + parseDurationToMinutes(b.duration), 0);
    const totalHours = Math.round(totalMinutes / 60);
    const streamsPerWeek = recentBroadcasts.length > 0
      ? (recentBroadcasts.length / 4).toFixed(1) // 30 days ≈ 4 weeks
      : '0';

    // Genre analysis from recent broadcasts
    const genreBreakdown = detectGenresFromTitles(recentBroadcasts.map(b => b.title));

    // Game-specific broadcasts
    const gameKeyword = gameName.toLowerCase().split(' ')[0];
    const gameBroadcasts = recentBroadcasts.filter(b =>
      b.title.toLowerCase().includes(gameKeyword) ||
      b.game_name?.toLowerCase().includes(gameKeyword)
    );
    const gameAvgConcurrent = gameBroadcasts.length > 0
      ? Math.round(gameBroadcasts.reduce((s, b) => s + estimateAvgConcurrent(b.view_count), 0) / gameBroadcasts.length)
      : null;

    const genreBroadcastRatio = recentBroadcasts.length > 0
      ? gameBroadcasts.length / recentBroadcasts.length
      : 0;

    // Steam lag analysis: did streams correlate with review spikes?
    const avgTotal = steamDaily.length > 0
      ? steamDaily.reduce((s, r) => s + r.up + r.down, 0) / steamDaily.length
      : 0;
    const peakThreshold = avgTotal * 1.5;

    const attributedDates = new Set<string>();
    let totalAttributedReviews = 0;
    let broadcastsWithSpike = 0;

    for (const b of recentBroadcasts.slice(0, 10)) {
      const broadcastTs = new Date(b.created_at).getTime() / 1000;
      for (let h = 0; h <= 48; h += 24) {
        const checkDate = new Date((broadcastTs + h * 3600) * 1000).toISOString().split('T')[0];
        const dayData = steamDaily.find(d => new Date(d.date * 1000).toISOString().split('T')[0] === checkDate);
        if (dayData && !attributedDates.has(checkDate)) {
          const total = dayData.up + dayData.down;
          const delta = total - avgTotal;
          if (delta > 0 && total >= peakThreshold) {
            attributedDates.add(checkDate);
            totalAttributedReviews += Math.round(delta);
            broadcastsWithSpike++;
          }
        }
      }
    }

    const avgReviewDelta = broadcastsWithSpike > 0 ? totalAttributedReviews / broadcastsWithSpike : 0;

    // Engagement rate estimate
    const engRate = avgViewCount < 500 ? 0.08 : avgViewCount < 2000 ? 0.04
      : avgViewCount < 10000 ? 0.02 : avgViewCount < 50000 ? 0.012 : 0.007;

    // V-Function (no category_percentile here — use default reach)
    const vResult = calcVFunction({
      avg_view_count: avgViewCount,
      review_delta_per_stream: avgReviewDelta,
      engagement_rate: engRate,
      genre_broadcast_ratio: genreBroadcastRatio,
      peak_hour_bonus: 1.0,
    });

    // JP streamer market rates (per sponsored stream)
    // Based on industry data: JP top tier ~¥2M/stream, mid tier ~¥300-500k
    // WSJ: global top = $50k/hour = ~¥7M, JP top = ~¥2M estimated
    const estimatedCostJpy =
      avgViewCount < 200   ? 20000      // micro: ¥20k
      : avgViewCount < 500 ? 50000      // small: ¥50k
      : avgViewCount < 1000 ? 100000    // ¥100k
      : avgViewCount < 3000 ? 200000    // ¥200k
      : avgViewCount < 10000 ? 500000   // ¥500k
      : avgViewCount < 30000 ? 1000000  // ¥1M
      : avgViewCount < 100000 ? 2000000 // ¥2M (JP top tier)
      : 5000000;                         // ¥5M+ (mega tier)

    const costPerPurchase = vResult.estimated_purchases_per_stream.mid > 0
      ? Math.round(estimatedCostJpy / vResult.estimated_purchases_per_stream.mid)
      : null;

    return NextResponse.json({
      streamer: {
        username: streamer.login,
        display_name: streamer.display_name,
        description: streamer.description,
        profile_image: streamer.profile_image_url,
        broadcaster_type: streamer.broadcaster_type,
        twitch_url: `https://www.twitch.tv/${streamer.login}`,
        // Accurate stats (last 30 days)
        avg_concurrent_viewers: avgViewCount,
        peak_concurrent_viewers: peakViewCount,
        streams_per_week: streamsPerWeek,
        total_hours_streamed: totalHours,
        broadcasts_analyzed: recentBroadcasts.length,
        viewer_note: liveViewers > 0 ? 'Live data' : 'Estimated from VOD (±50%)',
        // Genre breakdown
        genre_breakdown: genreBreakdown,
        // Game-specific
        game_avg_concurrent: gameAvgConcurrent,
        game_broadcasts_count: gameBroadcasts.length,
      },
      v_function: {
        v_score: vResult.v_score,
        tier: vResult.tier,
        cbi_index: vResult.cbi_index,
        interpretation: vResult.interpretation,
        components: {
          reach: vResult.components.reach_efficiency,
          engagement: vResult.components.engagement,
          conversion: vResult.components.conversion,
          fit: vResult.components.fit,
        },
      },
      game_analysis: {
        game_name: gameName,
        game_broadcasts_last_30d: gameBroadcasts.length,
        game_avg_concurrent: gameAvgConcurrent,
        avg_attributed_reviews: Math.round(avgReviewDelta),
        conversion_evidence: broadcastsWithSpike,
        efficiency_tier: vResult.tier,
        lag_curve_url: steamId
          ? `/api/clarity/lagcurve?steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}&streamer=${streamer.login}`
          : null,
      },
      roi_estimate: {
        estimated_cost_jpy: estimatedCostJpy,
        estimated_purchases: vResult.estimated_purchases_per_stream,
        cost_per_purchase_jpy: costPerPurchase,
        roi_note: costPerPurchase
          ? `¥${costPerPurchase.toLocaleString()} per purchase (estimated)`
          : 'Run a test campaign to get real conversion data',
      },
      recent_broadcasts: recentBroadcasts.slice(0, 5).map(b => ({
        title: b.title,
        date: b.created_at,
        duration_minutes: parseDurationToMinutes(b.duration),
        vod_views: b.view_count,
        estimated_concurrent: estimateAvgConcurrent(b.view_count),
        twitch_url: `https://www.twitch.tv/videos/${b.id}`,
      })),
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
