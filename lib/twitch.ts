/**
 * Twitch API utilities for J-Clarity
 * Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET env vars
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getTwitchToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

function twitchHeaders(token: string) {
  return {
    'Client-Id': process.env.TWITCH_CLIENT_ID!,
    'Authorization': `Bearer ${token}`,
  };
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
}

export interface TwitchStreamer {
  id: string;
  login: string;
  display_name: string;
  description: string;
  profile_image_url: string;
  view_count: number;
  broadcaster_type: string;
}

/** Search streamers currently streaming a specific game */
export async function getStreamsForGame(gameId: string, limit = 20): Promise<TwitchStream[]> {
  const token = await getTwitchToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?game_id=${gameId}&first=${limit}&language=ja`,
    { headers: twitchHeaders(token) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

/** Get game ID by name */
export async function getTwitchGameId(gameName: string): Promise<string | null> {
  const token = await getTwitchToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`,
    { headers: twitchHeaders(token) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.id || null;
}

/** Get streamer info by username */
export async function getStreamerInfo(username: string): Promise<TwitchStreamer | null> {
  const token = await getTwitchToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${username}`,
    { headers: twitchHeaders(token) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0] || null;
}

/** Get past broadcasts for a streamer */
export async function getPastBroadcasts(userId: string, limit = 10): Promise<{
  id: string;
  title: string;
  created_at: string;
  duration: string;
  view_count: number;
  game_name?: string;
}[]> {
  const token = await getTwitchToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/videos?user_id=${userId}&first=${limit}&type=archive`,
    { headers: twitchHeaders(token) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map((v: any) => ({
    id: v.id,
    title: v.title,
    created_at: v.created_at,
    duration: v.duration,
    view_count: v.view_count,
  }));
}
