import { NextRequest, NextResponse } from 'next/server';
import { getTwitchGameId, getTopJPStreamersForGame, getPastBroadcasts, getStreamerInfo } from '@/lib/twitch';
import { getSteamAppInfo } from '@/lib/steam';

/**
 * J-Clarity Genre Ranking
 * GET /api/clarity/ranking?steam_id=xxx&game_name=xxx
 *
 * Returns top JP streamers for this game's genre,
 * with concurrent stream detection and attribution notes.
 */

// Genre detection from Steam tags / game titles
const GENRE_KEYWORDS: Record<string, string[]> = {
  'FPS / Shooter':     ['fps', 'shooter', 'counter-strike', 'valorant', 'overwatch', 'call of duty', 'battlefield', 'apex', 'halo'],
  'Survival':          ['survival', 'valheim', 'rust', 'ark', 'dayz', 'subnautica', 'the forest', 'green hell'],
  'RPG':               ['rpg', 'final fantasy', 'dragon quest', 'elden ring', 'persona', 'tales of', 'monster hunter', 'jrpg'],
  'Battle Royale':     ['battle royale', 'pubg', 'fortnite', 'warzone', 'fall guys'],
  'MOBA / Strategy':   ['moba', 'dota', 'league of legends', 'strategy', 'civilization', 'age of empires'],
  'Indie / Platformer':['indie', 'platformer', 'hollow knight', 'celeste', 'ori', 'hades', 'dead cells'],
  'Horror':            ['horror', 'resident evil', 'silent hill', 'outlast', 'phasmophobia', 'dead by daylight'],
  'Card / Auto Battler':['card', 'deck', 'hearthstone', 'slay the spire', 'auto battler', 'shadowverse'],
  'Sports / Racing':   ['sports', 'football', 'soccer', 'racing', 'fifa', 'nba', 'gran turismo'],
  'MMO / Online':      ['mmo', 'online', 'world of warcraft', 'final fantasy xiv', 'black desert', 'lost ark'],
};

function detectGenre(gameName: string, genres: string[]): string {
  const combined = [gameName, ...genres].join(' ').toLowerCase();
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some(k => combined.includes(k))) return genre;
  }
  return 'General';
}

function detectStreamerGenres(broadcasts: { title: string; game_id?: string }[]): string[] {
  const titleText = broadcasts.map(b => b.title).join(' ').toLowerCase();
  const detected: string[] = [];
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some(k => titleText.includes(k))) detected.push(genre);
  }
  return detected.slice(0, 3);
}

function parseDuration(duration: string): number {
  const h = parseInt(duration.match(/(\d+)h/)?.[1] || '0');
  const m = parseInt(duration.match(/(\d+)m/)?.[1] || '0');
  return h * 60 + m;
}

export async function GET(req: NextRequest) {
  const steamId = req.nextUrl.searchParams.get('steam_id');
  const gameName = req.nextUrl.searchParams.get('game_name') || '';

  if (!steamId || !gameName) {
    return NextResponse.json({ error: 'Missing steam_id or game_name' }, { status: 400 });
  }

  try {
    // Get game info + Twitch game ID in parallel
    const [appInfo, twitchGameId] = await Promise.all([
      getSteamAppInfo(steamId),
      getTwitchGameId(gameName),
    ]);

    const steamGenres = appInfo?.genres || [];
    const gameGenre = detectGenre(gameName, steamGenres);

    if (!twitchGameId) {
      return NextResponse.json({
        game_genre: gameGenre,
        streamers: [],
        note: 'Game not found on Twitch',
      });
    }

    // Get current live streams for this game
    const liveStreams = await getTopJPStreamersForGame(twitchGameId, 50);

    // Total concurrent viewers (for attribution calculation)
    const totalConcurrentViewers = liveStreams.reduce((s, st) => s + st.viewer_count, 0);

    // Filter to JP streamers first, fallback to all if less than 3
    const jpStreams = liveStreams.filter(s => s.language === 'ja');
    const streamsToRank = jpStreams.length >= 3 ? jpStreams : liveStreams;

    // Build streamer ranking with attribution
    const streamersWithAttribution = await Promise.all(
      streamsToRank.slice(0, 10).map(async (stream) => {
        // Get past broadcasts to determine genre affinity
        const streamerInfo = await getStreamerInfo(stream.user_name).catch(() => null);
        const broadcasts = streamerInfo
          ? await getPastBroadcasts(streamerInfo.id, 15).catch(() => [])
          : [];

        const streamerGenres = detectStreamerGenres(broadcasts);
        const genreMatch = streamerGenres.includes(gameGenre);

        // Attribution: this streamer's share of concurrent viewers
        const viewerShare = totalConcurrentViewers > 0
          ? stream.viewer_count / totalConcurrentViewers
          : 1;

        // Avg view count from past broadcasts
        const avgViewCount = broadcasts.length > 0
          ? Math.round(broadcasts.reduce((s, b) => s + b.view_count, 0) / broadcasts.length)
          : stream.viewer_count;

        // Total streaming hours (past 15 broadcasts)
        const totalHours = Math.round(
          broadcasts.reduce((s, b) => s + parseDuration(b.duration), 0) / 60
        );

        // Estimated cost
        const estimatedCostJpy = avgViewCount < 500 ? 30000
          : avgViewCount < 2000 ? 100000
          : avgViewCount < 10000 ? 300000
          : avgViewCount < 50000 ? 800000
          : 2000000;

        return {
          username: stream.user_name,
          viewer_count: stream.viewer_count,
          stream_title: stream.title,
          language: stream.language,
          twitch_url: `https://www.twitch.tv/${stream.user_name}`,
          profile_image: streamerInfo?.profile_image_url || '',
          // Genre analysis
          specializes_in: streamerGenres,
          genre_match: genreMatch,
          genre_match_label: genreMatch ? '✅ Genre match' : '⚠️ Different genre',
          // Attribution
          viewer_share_pct: Math.round(viewerShare * 100),
          concurrent_streamers: liveStreams.length,
          attribution_note: liveStreams.length > 1
            ? `${liveStreams.length} streamers live simultaneously. This streamer has ${Math.round(viewerShare * 100)}% of total viewers.`
            : 'Solo streamer — full attribution possible',
          // Stats
          avg_view_count: avgViewCount,
          total_streaming_hours: totalHours,
          estimated_cost_jpy: estimatedCostJpy,
          // Ranking score: genre match + viewer share + audience size
          ranking_score: Math.round(
            (genreMatch ? 40 : 10) +
            (viewerShare * 30) +
            Math.min(Math.log10(avgViewCount + 1) * 10, 30)
          ),
          streamer_page_url: `/clarity/streamer/${stream.user_name}?steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}`,
        };
      })
    );

    // Sort by ranking score
    streamersWithAttribution.sort((a, b) => b.ranking_score - a.ranking_score);

    return NextResponse.json({
      game_name: gameName,
      game_genre: gameGenre,
      total_live_streams: liveStreams.length,
      total_concurrent_viewers: totalConcurrentViewers,
      concurrent_warning: liveStreams.length > 3
        ? `⚠️ ${liveStreams.length} streamers are currently live. Attribution scores are divided among them.`
        : null,
      streamers: streamersWithAttribution,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
