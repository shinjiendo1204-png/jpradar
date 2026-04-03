import { NextRequest, NextResponse } from 'next/server';
import { getStreamerInfo, getPastBroadcasts } from '@/lib/twitch';
import { calcVFunction, calcCBIFromComments } from '@/lib/vfunction';

/**
 * J-Clarity Streamer Analysis
 * GET /api/clarity/streamer?username=xxx&steam_id=yyy&game_name=zzz
 *
 * Returns streamer profile + past broadcasts for this game + ROI estimate
 */

interface BroadcastWithImpact {
  id: string;
  title: string;
  date: string;
  duration_minutes: number;
  view_count: number;
  game_name?: string;
  twitch_url: string;
}

async function getSteamDailyReviews(steamId: string): Promise<{ date: number; up: number; down: number }[]> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviewhistogram/${steamId}?json=1`
    );
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

function parseDurationToMinutes(duration: string): number {
  // Twitch format: "1h30m45s"
  const hours = parseInt(duration.match(/(\d+)h/)?.[1] || '0');
  const mins = parseInt(duration.match(/(\d+)m/)?.[1] || '0');
  return hours * 60 + mins;
}

function calcInfluenceScore(viewCount: number, reviewDelta: number): number {
  if (viewCount === 0) return 0;
  return Math.round((reviewDelta / viewCount) * 10000) / 10;
}

function estimatePurchases(viewCount: number, influenceScore: number): {
  low: number;
  mid: number;
  high: number;
} {
  // base conversion: 0.1% - 2% of viewers
  // influenced by influenceScore
  const baseRate = influenceScore > 5 ? 0.015 : influenceScore > 2 ? 0.008 : 0.003;
  return {
    low: Math.round(viewCount * baseRate * 0.5),
    mid: Math.round(viewCount * baseRate),
    high: Math.round(viewCount * baseRate * 2),
  };
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  const steamId = req.nextUrl.searchParams.get('steam_id');
  const gameName = req.nextUrl.searchParams.get('game_name') || '';

  if (!username) {
    return NextResponse.json({ error: 'Missing ?username=' }, { status: 400 });
  }

  try {
    // lowercase username for Twitch API
    const normalizedUsername = username.toLowerCase();

    const [streamer, steamDaily] = await Promise.all([
      getStreamerInfo(normalizedUsername),
      steamId ? getSteamDailyReviews(steamId) : Promise.resolve([]),
    ]);

    if (!streamer) {
      return NextResponse.json({ error: `Streamer "${username}" not found on Twitch` }, { status: 404 });
    }

    const broadcasts = await getPastBroadcasts(streamer.id, 20);

    // Filter broadcasts that include this game
    const gameKeywords = gameName.toLowerCase().split(' ').filter(w => w.length > 2);
    const relevantBroadcasts = broadcasts.filter(b => {
      if (!gameName) return true;
      const titleLower = b.title.toLowerCase();
      return gameKeywords.some(k => titleLower.includes(k));
    });

    // For each broadcast, check Steam review change in next 48h
    const broadcastsWithImpact: (BroadcastWithImpact & {
      review_delta_24h: number;
      influence_score: number;
      estimated_purchases: { low: number; mid: number; high: number };
    })[] = relevantBroadcasts.map(b => {
      const broadcastDate = new Date(b.created_at);
      const broadcastTs = Math.floor(broadcastDate.getTime() / 1000);
      const nextDayTs = broadcastTs + 86400;
      const twoDaysTs = broadcastTs + 172800;

      // Find Steam reviews in 24-48h window after broadcast
      const reviewsInWindow = steamDaily.filter(
        r => r.date >= broadcastTs && r.date <= twoDaysTs
      );
      const reviewDelta = reviewsInWindow.reduce((s, r) => s + r.up + r.down, 0);
      const influenceScore = calcInfluenceScore(b.view_count, reviewDelta);

      return {
        id: b.id,
        title: b.title,
        date: b.created_at,
        duration_minutes: parseDurationToMinutes(b.duration),
        view_count: b.view_count,
        twitch_url: `https://www.twitch.tv/videos/${b.id}`,
        review_delta_24h: reviewDelta,
        influence_score: influenceScore,
        estimated_purchases: estimatePurchases(b.view_count, influenceScore),
      };
    });

    // Overall streamer stats
    const avgViewCount = broadcasts.length > 0
      ? Math.round(broadcasts.reduce((s, b) => s + b.view_count, 0) / broadcasts.length)
      : 0;

    // Genre fit detection: title match + game name + keyword
    const titleText = broadcasts.map(b => b.title).join(' ').toLowerCase();
    const gameNameLower = gameName.toLowerCase();
    const hasGameInTitle = broadcasts.some(b => b.title.toLowerCase().includes(gameNameLower.split(' ')[0]));
    const hasKeywordInTitle = titleText.includes(gameNameLower);
    const genreFitScore = (hasGameInTitle || hasKeywordInTitle) ? 1.0 : 0.4;

    // Clips per broadcast (engagement proxy — estimate from view count)
    const clipsPerBroadcast = avgViewCount > 10000 ? 3 : avgViewCount > 2000 ? 1 : 0.3;

    // Review delta per stream (from correlation data)
    const impactBroadcasts = broadcastsWithImpact.filter(b => b.review_delta_24h > 0);
    const avgReviewDelta = impactBroadcasts.length > 0
      ? impactBroadcasts.reduce((s, b) => s + b.review_delta_24h, 0) / impactBroadcasts.length
      : 0.1;

    // V-Function
    const engagementRate = avgViewCount > 0
      ? Math.min(clipsPerBroadcast / (avgViewCount / 1000), 1)
      : 0;

    const vResult = calcVFunction({
      avg_view_count: avgViewCount,
      engagement_rate: engagementRate,
      review_delta_per_stream: avgReviewDelta,
      genre_fit: genreFitScore,
      peak_hour_bonus: 1.0,
    });

    const avgInfluence = broadcastsWithImpact.length > 0
      ? Math.round(broadcastsWithImpact.reduce((s, b) => s + b.influence_score, 0) / broadcastsWithImpact.length * 10) / 10
      : 0;

    const bestBroadcast = broadcastsWithImpact.sort((a, b) => b.influence_score - a.influence_score)[0];

    // Estimated cost (rough JP streamer rates)
    const estimatedCostJpy = avgViewCount < 500 ? 30000
      : avgViewCount < 2000 ? 100000
      : avgViewCount < 10000 ? 300000
      : avgViewCount < 50000 ? 800000
      : 2000000;

    const estimatedPurchases = vResult.estimated_purchases_per_stream;

    // CPP = Cost Per Purchase
    const costPerPurchase = estimatedPurchases.mid > 0
      ? Math.round(estimatedCostJpy / estimatedPurchases.mid)
      : null;

    return NextResponse.json({
      streamer: {
        username: streamer.login,
        display_name: streamer.display_name,
        description: streamer.description,
        profile_image: streamer.profile_image_url,
        total_views: streamer.view_count,
        broadcaster_type: streamer.broadcaster_type,
        twitch_url: `https://www.twitch.tv/${streamer.login}`,
      },
      // V-Function score
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
        relevant_broadcasts: broadcastsWithImpact.length,
        avg_view_count: avgViewCount,
        avg_influence_score: avgInfluence,
        efficiency_tier: vResult.tier,
        best_broadcast: bestBroadcast || null,
        lag_curve_url: steamId ? `/api/clarity/lagcurve?steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}&streamer=${streamer.login}` : null,
      },
      roi_estimate: {
        estimated_cost_jpy: estimatedCostJpy,
        estimated_purchases: estimatedPurchases,
        cost_per_purchase_jpy: costPerPurchase,
        roi_note: costPerPurchase
          ? `¥${costPerPurchase.toLocaleString()} per purchase (estimated)`
          : 'Insufficient data for ROI estimate',
      },
      recent_broadcasts: broadcastsWithImpact.slice(0, 5),
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
