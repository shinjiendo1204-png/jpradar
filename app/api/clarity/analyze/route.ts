import { NextRequest, NextResponse } from 'next/server';
import { getSteamReviews, getSteamAppInfo, getRecentJapaneseReviews } from '@/lib/steam';
import { getTwitchGameId, getStreamsForGame } from '@/lib/twitch';
import { createClient } from '@supabase/supabase-js';

/**
 * J-Clarity: Analyze a game's Japan market performance
 * GET /api/clarity/analyze?steam_id=892970&game_name=Valheim
 */

export async function GET(req: NextRequest) {
  const steamId = req.nextUrl.searchParams.get('steam_id');
  const gameName = req.nextUrl.searchParams.get('game_name') || '';

  if (!steamId) {
    return NextResponse.json({ error: 'Missing ?steam_id=' }, { status: 400 });
  }

  try {
    // Fetch all data in parallel
    const [reviews, appInfo, recentReviews, twitchGameId] = await Promise.all([
      getSteamReviews(steamId, 'japanese'),
      getSteamAppInfo(steamId),
      getRecentJapaneseReviews(steamId, 10),
      gameName ? getTwitchGameId(gameName) : Promise.resolve(null),
    ]);

    // Get Twitch streams if game found
    const streams = twitchGameId
      ? await getStreamsForGame(twitchGameId, 10)
      : [];

    // Analyze recent reviews for buying signals
    const buyingSignals = recentReviews.filter(r => {
      const text = r.review;
      return (
        text.includes('買') ||
        text.includes('購入') ||
        text.includes('おすすめ') ||
        text.includes('面白') ||
        text.includes('最高')
      );
    }).length;

    // Calculate Japan score (0-100)
    let japanScore = 0;
    if (reviews) {
      japanScore += Math.min(reviews.review_score * 8, 60); // max 60 from score
      japanScore += Math.min(reviews.total_reviews / 10, 20); // max 20 from volume
    }
    japanScore += Math.min(streams.length * 2, 10); // max 10 from streamers
    japanScore += Math.min(buyingSignals * 2, 10);  // max 10 from buying signals
    japanScore = Math.round(Math.min(japanScore, 100));

    // Top streamers by viewer count
    const topStreamers = streams
      .sort((a, b) => b.viewer_count - a.viewer_count)
      .slice(0, 5)
      .map(s => ({
        name: s.user_name,
        viewers: s.viewer_count,
        title: s.title,
        twitch_url: `https://www.twitch.tv/${s.user_name}`,
      }));

    return NextResponse.json({
      steam_id: steamId,
      game_name: appInfo?.name || gameName,
      header_image: appInfo?.header_image || '',
      japan_score: japanScore,
      reviews: {
        total: reviews?.total_reviews || 0,
        positive: reviews?.total_positive || 0,
        score_desc: reviews?.review_score_desc || 'N/A',
      },
      twitch: {
        active_streams: streams.length,
        total_viewers: streams.reduce((s, st) => s + st.viewer_count, 0),
        top_streamers: topStreamers,
      },
      buying_signals: buyingSignals,
      recent_reviews: recentReviews.slice(0, 5).map(r => ({
        text_ja: r.review.slice(0, 150),
        text_en: '', // translated client-side or via separate call
        positive: r.voted_up,
        timestamp: r.timestamp,
      })),
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
