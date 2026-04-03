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

/** Clean game name for Twitch search (remove trademark symbols etc.) */
function cleanGameName(name: string): string {
  return name
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Search streamers currently streaming a specific game (no language filter, min viewers threshold) */
export async function getStreamsForGame(gameId: string, limit = 50, minViewers = 20): Promise<TwitchStream[]> {
  const token = await getTwitchToken();
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?game_id=${gameId}&first=${limit}`,
    { headers: twitchHeaders(token) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  // Filter by minimum viewers
  return (data.data || []).filter((s: TwitchStream) => s.viewer_count >= minViewers);
}

/** Get game ID by name — tries exact match then search fallback */
export async function getTwitchGameId(gameName: string): Promise<string | null> {
  const token = await getTwitchToken();
  const cleaned = cleanGameName(gameName);

  // Try exact match first
  const res = await fetch(
    `https://api.twitch.tv/helix/games?name=${encodeURIComponent(cleaned)}`,
    { headers: twitchHeaders(token) }
  );
  if (res.ok) {
    const data = await res.json();
    if (data.data?.[0]?.id) return data.data[0].id;
  }

  // Fallback: search by keyword
  const searchRes = await fetch(
    `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(cleaned)}&first=1`,
    { headers: twitchHeaders(token) }
  );
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  return searchData.data?.[0]?.id || null;
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

/** Get multiple streamers info at once */
export async function getStreamersInfo(usernames: string[]): Promise<TwitchStreamer[]> {
  if (!usernames.length) return [];
  const token = await getTwitchToken();
  const query = usernames.slice(0, 100).map(u => `login=${encodeURIComponent(u)}`).join('&');
  const res = await fetch(
    `https://api.twitch.tv/helix/users?${query}`,
    { headers: twitchHeaders(token) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

/** Get top JP streamers for a game by searching recent VODs */
export async function getTopJPStreamersForGame(gameId: string, limit = 50): Promise<{
  user_id: string;
  user_name: string;
  viewer_count: number;
  title: string;
  language: string;
  started_at: string;
}[]> {
  const token = await getTwitchToken();
  // Get live + recent streams, no language filter
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?game_id=${gameId}&first=${limit}`,
    { headers: twitchHeaders(token) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).filter((s: any) => s.viewer_count >= 20);
}

/** Get past broadcasts for a streamer */
export async function getPastBroadcasts(userId: string, limit = 10): Promise<{
  id: string;
  title: string;
  created_at: string;
  duration: string;
  view_count: number;
  game_name?: string;
  game_id?: string;
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
    game_id: v.game_id,
  }));
}
