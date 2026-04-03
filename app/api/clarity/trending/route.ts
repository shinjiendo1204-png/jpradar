import { NextRequest, NextResponse } from 'next/server';

/**
 * J-Clarity Trending: Hot games on Twitch JP right now
 * GET /api/clarity/trending
 */

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

const trendingCache = { data: null as any, expiresAt: 0 };

export async function GET() {
  // Cache for 15 minutes
  if (trendingCache.data && Date.now() < trendingCache.expiresAt) {
    return NextResponse.json({ ...trendingCache.data, cached: true });
  }

  try {
    const token = await getTwitchToken();
    const headers = {
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    };

    // Get top games on Twitch
    const gamesRes = await fetch(
      'https://api.twitch.tv/helix/games/top?first=20',
      { headers }
    );
    if (!gamesRes.ok) throw new Error('Twitch games failed');
    const gamesData = await gamesRes.json();

    // Get JP streams for each top game to find JP-relevant ones
    const jpStreams = await fetch(
      `https://api.twitch.tv/helix/streams?first=100&language=ja`,
      { headers }
    );
    const jpStreamsData = jpStreams.ok ? await jpStreams.json() : { data: [] };

    // Count JP viewers per game
    const jpViewersByGame: Record<string, { viewers: number; streamers: number; game_name: string }> = {};
    for (const stream of jpStreamsData.data || []) {
      if (!jpViewersByGame[stream.game_id]) {
        jpViewersByGame[stream.game_id] = {
          viewers: 0, streamers: 0, game_name: stream.game_name,
        };
      }
      jpViewersByGame[stream.game_id].viewers += stream.viewer_count;
      jpViewersByGame[stream.game_id].streamers += 1;
    }

    // Build trending list
    const trending = Object.entries(jpViewersByGame)
      .filter(([, v]) => v.streamers >= 2)
      .sort(([, a], [, b]) => b.viewers - a.viewers)
      .slice(0, 10)
      .map(([game_id, v], i) => ({
        rank: i + 1,
        game_id,
        game_name: v.game_name,
        jp_viewers: v.viewers,
        jp_streamers: v.streamers,
        heat_score: Math.min(Math.round(Math.log10(v.viewers + 1) * 30), 100),
      }));

    const result = {
      trending_jp_games: trending,
      generated_at: new Date().toISOString(),
    };

    trendingCache.data = result;
    trendingCache.expiresAt = Date.now() + 15 * 60 * 1000;

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
