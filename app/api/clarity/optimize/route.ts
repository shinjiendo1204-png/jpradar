import { NextRequest, NextResponse } from 'next/server';
import { getTwitchGameId, getTopJPStreamersForGame, getStreamerInfo, getPastBroadcasts } from '@/lib/twitch';
import { getSteamAppInfo } from '@/lib/steam';
import { calcVFunction, optimizeBudget, StreamerForOptimizer } from '@/lib/vfunction';

/**
 * Budget Optimizer
 * POST { steam_id, game_name, budget_jpy }
 * Returns optimal streamer portfolio for the budget
 */

const GENRE_KEYWORDS: Record<string, string[]> = {
  'FPS': ['fps', 'shooter', 'counter-strike', 'valorant', 'overwatch', 'call of duty', 'apex'],
  'Survival': ['survival', 'valheim', 'rust', 'ark', 'dayz', 'subnautica'],
  'RPG': ['rpg', 'final fantasy', 'dragon quest', 'elden ring', 'persona', 'monster hunter'],
  'Battle Royale': ['battle royale', 'pubg', 'fortnite', 'warzone'],
  'Indie': ['indie', 'platformer', 'hollow knight', 'celeste', 'hades'],
  'Horror': ['horror', 'resident evil', 'silent hill', 'phasmophobia'],
  'Card': ['card', 'deck', 'hearthstone', 'shadowverse'],
};

function detectGenre(name: string, genres: string[]): string {
  const text = [name, ...genres].join(' ').toLowerCase();
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return genre;
  }
  return 'General';
}

async function getSteamLagData(steamId: string): Promise<{ date: string; total: number }[]> {
  try {
    const res = await fetch(`https://store.steampowered.com/appreviewhistogram/${steamId}?json=1`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results?.recent || []).map((r: any) => ({
      date: new Date(r.date * 1000).toISOString().split('T')[0],
      total: (r.recommendations_up || 0) + (r.recommendations_down || 0),
    }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { steam_id, game_name, budget_jpy } = await req.json();

  if (!steam_id || !game_name || !budget_jpy) {
    return NextResponse.json({ error: 'Missing steam_id, game_name, or budget_jpy' }, { status: 400 });
  }

  try {
    const [appInfo, twitchGameId, steamDaily] = await Promise.all([
      getSteamAppInfo(steam_id),
      getTwitchGameId(game_name),
      getSteamLagData(steam_id),
    ]);

    const genre = detectGenre(game_name, appInfo?.genres || []);
    const avgDailyReviews = steamDaily.length > 0
      ? steamDaily.reduce((s, d) => s + d.total, 0) / steamDaily.length
      : 0;

    if (!twitchGameId) {
      return NextResponse.json({ error: 'Game not found on Twitch' }, { status: 404 });
    }

    const liveStreams = await getTopJPStreamersForGame(twitchGameId, 30);

    // Calculate category average viewers
    const categoryAvgViews = liveStreams.length > 0
      ? liveStreams.reduce((s, st) => s + st.viewer_count, 0) / liveStreams.length
      : 5000;

    // Build V-Function scores for each streamer
    const streamersWithScores: StreamerForOptimizer[] = await Promise.all(
      liveStreams.slice(0, 15).map(async (stream) => {
        const streamerInfo = await getStreamerInfo(stream.user_name).catch(() => null);
        const broadcasts = streamerInfo
          ? await getPastBroadcasts(streamerInfo.id, 15).catch(() => [])
          : [];

        const avgViews = broadcasts.length > 0
          ? broadcasts.reduce((s, b) => s + b.view_count, 0) / broadcasts.length
          : stream.viewer_count;

        // Check genre fit: title keywords + game_id match + language
        const titleText = broadcasts.map(b => b.title).join(' ').toLowerCase();
        const gameNameLower = game_name.toLowerCase();
        const genreKeywords = GENRE_KEYWORDS[genre] || [];

        // Match if: game name in title, genre keyword in title, or same game_id in broadcasts
        const hasGameInTitle = broadcasts.some(b => b.title.toLowerCase().includes(gameNameLower.split(' ')[0]));
        const hasGenreKeyword = genreKeywords.some(k => titleText.includes(k));
        const sameGameId = broadcasts.some(b => (b as any).game_id === twitchGameId);

        const genreFit = (hasGameInTitle || hasGenreKeyword || sameGameId) ? 1.0 : 0.3;

        // Estimate clips per broadcast (proxy for engagement)
        const clipsPerBroadcast = avgViews > 10000 ? 3 : avgViews > 2000 ? 1 : 0.3;

        // Get actual Lag Curve data for this streamer
        let reviewDeltaPerStream = 0.1; // default: no evidence
        try {
          const lagRes = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.jprader.net'}/api/clarity/lagcurve?steam_id=${steam_id}&game_name=${encodeURIComponent(game_name)}&streamer=${stream.user_name}`
          );
          if (lagRes.ok) {
            const lagData = await lagRes.json();
            reviewDeltaPerStream = Math.max(0.1, lagData.avg_attributed_reviews_per_stream || 0.1);
          }
        } catch {
          reviewDeltaPerStream = 0.1;
        }

        // Engagement rate estimate from clips relative to viewers
        const engagementRate = avgViews > 0 ? Math.min(clipsPerBroadcast / (avgViews / 1000), 1) : 0;

        const vResult = calcVFunction({
          avg_view_count: avgViews,
          avg_category_views: categoryAvgViews,
          review_delta_per_stream: reviewDeltaPerStream,
          engagement_rate: engagementRate,
          genre_fit: genreFit,
          peak_hour_bonus: 1.0,
        });

        const estimatedCost = avgViews < 500 ? 30000
          : avgViews < 2000 ? 100000
          : avgViews < 10000 ? 300000
          : avgViews < 50000 ? 800000
          : 2000000;

        return {
          username: stream.user_name,
          estimated_cost_jpy: estimatedCost,
          v_score: vResult.v_score,
          tier: vResult.tier,
          estimated_purchases_mid: vResult.estimated_purchases_per_stream.mid,
          genre_fit: genreFit > 0.5,
          avg_view_count: Math.round(avgViews),
        };
      })
    );

    const portfolio = optimizeBudget(streamersWithScores, budget_jpy);

    return NextResponse.json({
      game_name,
      genre,
      budget_jpy,
      portfolio,
      all_streamers_scored: streamersWithScores
        .sort((a, b) => b.v_score - a.v_score)
        .slice(0, 10),
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
