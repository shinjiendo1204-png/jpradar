import { NextRequest, NextResponse } from 'next/server';

/**
 * Search Twitch streamers by username
 * GET /api/clarity/search-streamer?q=IzakOOO
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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const token = await getTwitchToken();
    const headers = {
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    };

    const res = await fetch(
      `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(q)}&first=5&live_only=false`,
      { headers }
    );
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();

    const results = (data.data || []).map((ch: any) => ({
      id: ch.id,
      login: ch.broadcaster_login,
      display_name: ch.display_name,
      thumbnail: ch.thumbnail_url,
      is_live: ch.is_live,
      game_name: ch.game_name,
      broadcaster_language: ch.broadcaster_language,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
