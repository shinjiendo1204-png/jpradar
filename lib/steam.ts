/**
 * Steam API utilities for J-Clarity
 * No API key required for most endpoints
 */

export interface SteamReviewSnapshot {
  app_id: string;
  app_name: string;
  total_reviews: number;
  total_positive: number;
  total_negative: number;
  review_score: number; // 0-9
  review_score_desc: string;
  fetched_at: string;
}

export interface SteamAppInfo {
  app_id: string;
  name: string;
  short_description: string;
  header_image: string;
  developers: string[];
  publishers: string[];
  release_date: string;
  genres: string[];
}

/** Get review summary for a Steam app */
export async function getSteamReviews(appId: string, language = 'japanese'): Promise<SteamReviewSnapshot | null> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=${language}&num_per_page=0`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;

    const q = data.query_summary;
    return {
      app_id: appId,
      app_name: '',
      total_reviews: q.total_reviews || 0,
      total_positive: q.total_positive || 0,
      total_negative: q.total_negative || 0,
      review_score: q.review_score || 0,
      review_score_desc: q.review_score_desc || '',
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Get basic app info */
export async function getSteamAppInfo(appId: string): Promise<SteamAppInfo | null> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const app = data[appId];
    if (!app?.success) return null;
    const d = app.data;

    return {
      app_id: appId,
      name: d.name || '',
      short_description: d.short_description || '',
      header_image: d.header_image || '',
      developers: d.developers || [],
      publishers: d.publishers || [],
      release_date: d.release_date?.date || '',
      genres: (d.genres || []).map((g: any) => g.description),
    };
  } catch {
    return null;
  }
}

/** Get recent Japanese reviews (for chat-like analysis) */
export async function getRecentJapaneseReviews(appId: string, count = 20): Promise<{
  author: string;
  review: string;
  voted_up: boolean;
  timestamp: number;
}[]> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=japanese&num_per_page=${count}&filter=recent`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.reviews || []).map((r: any) => ({
      author: r.author?.steamid || '',
      review: r.review?.slice(0, 300) || '',
      voted_up: r.voted_up || false,
      timestamp: r.timestamp_created || 0,
    }));
  } catch {
    return [];
  }
}
