import { NextRequest, NextResponse } from 'next/server';

/**
 * Top JP Streamers Now — from all of Twitch JP (not game-specific)
 * Also provides genre-based ranking
 * GET /api/clarity/jp-streamers?genre=FPS
 */

const GENRE_GAME_MAP: Record<string, string[]> = {
  'FPS':          ['Counter-Strike', 'Valorant', 'Apex Legends', 'Call of Duty', 'Overwatch 2', 'Rainbow Six Siege'],
  'RPG':          ['Final Fantasy XIV', 'Monster Hunter', 'Elden Ring', 'Dragon Quest', 'Persona', 'Pokemon'],
  'Survival':     ['Minecraft', 'Valheim', 'Rust', 'Palworld', 'ARK'],
  'Battle Royale':['PUBG', 'Fortnite', 'Warzone'],
  'Card':         ['Shadowverse', 'Hearthstone', 'Slay the Spire'],
  'Horror':       ['Phasmophobia', 'Dead by Daylight', 'Resident Evil'],
  'Sports':       ['FIFA', 'Gran Turismo', 'Rocket League'],
  'Just Chatting':['Just Chatting'],
};

const cache = new Map<string, { data: any; expiresAt: number }>();

async function getTwitchToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export async function GET(req: NextRequest) {
  const genreFilter = req.nextUrl.searchParams.get('genre') || 'all';
  const cacheKey = `jp-streamers-${genreFilter}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const token = await getTwitchToken();
    const headers = {
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    };

    let streams: any[] = [];

    if (genreFilter === 'all' || genreFilter === 'Just Chatting') {
      // Get all JP streams sorted by viewers
      const res = await fetch(
        'https://api.twitch.tv/helix/streams?first=100&language=ja',
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        streams = data.data || [];
      }
    } else {
      // Get streams for specific games in this genre
      const gameNames = GENRE_GAME_MAP[genreFilter] || [];
      // Search for game IDs
      for (const gameName of gameNames.slice(0, 3)) {
        const gameRes = await fetch(
          `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`,
          { headers }
        );
        if (!gameRes.ok) continue;
        const gameData = await gameRes.json();
        const gameId = gameData.data?.[0]?.id;
        if (!gameId) continue;

        const streamRes = await fetch(
          `https://api.twitch.tv/helix/streams?game_id=${gameId}&first=20&language=ja`,
          { headers }
        );
        if (!streamRes.ok) continue;
        const streamData = await streamRes.json();
        streams.push(...(streamData.data || []));
      }
    }

    // Filter JP only, min 20 viewers
    const jpStreams = streams
      .filter(s => s.language === 'ja' && s.viewer_count >= 20)
      .sort((a, b) => b.viewer_count - a.viewer_count);

    // Deduplicate
    const seen = new Set<string>();
    const uniqueStreams = jpStreams.filter(s => {
      if (seen.has(s.user_id)) return false;
      seen.add(s.user_id);
      return true;
    }).slice(0, 20);

    // Add estimated cost and efficiency hint
    const enriched = uniqueStreams.map((s, i) => ({
      rank: i + 1,
      username: s.user_login,
      display_name: s.user_name,
      viewer_count: s.viewer_count,
      game_name: s.game_name,
      title: s.title,
      language: s.language,
      twitch_url: `https://www.twitch.tv/${s.user_login}`,
      // Cost estimate based on JP market rates
      estimated_cost_jpy:
        s.viewer_count < 500 ? 50000
        : s.viewer_count < 2000 ? 150000
        : s.viewer_count < 10000 ? 400000
        : s.viewer_count < 30000 ? 1000000
        : 2000000,
    }));

    const result = {
      genre: genreFilter,
      total: enriched.length,
      streamers: enriched,
      available_genres: Object.keys(GENRE_GAME_MAP),
      generated_at: new Date().toISOString(),
    };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + 10 * 60 * 1000 }); // 10 min cache
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
