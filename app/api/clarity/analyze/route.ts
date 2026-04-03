import { NextRequest, NextResponse } from 'next/server';
import { getSteamReviews, getSteamAppInfo, getRecentJapaneseReviews } from '@/lib/steam';
import { getTwitchGameId, getStreamsForGame } from '@/lib/twitch';

/**
 * J-Clarity: Analyze a game's Japan market performance
 * GET /api/clarity/analyze?steam_id=892970&game_name=Valheim
 */

async function summarizeReviews(reviews: { text: string; positive: boolean }[]): Promise<{
  positive: { theme: string; count: number }[];
  negative: { theme: string; count: number }[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || reviews.length === 0) {
    return { positive: [], negative: [] };
  }

  const texts = reviews.map(r => `[${r.positive ? 'POSITIVE' : 'NEGATIVE'}] ${r.text}`).join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are analyzing Japanese game reviews. Extract the 3 most common positive themes and 3 most common negative themes.
Return JSON exactly like:
{
  "positive": [{"theme": "English summary", "count": N}, ...],
  "negative": [{"theme": "English summary", "count": N}, ...]
}
Estimate counts based on how many reviews mention each theme. Be concise (max 8 words per theme).`,
          },
          { role: 'user', content: texts },
        ],
        max_tokens: 300,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return {
      positive: parsed.positive?.slice(0, 3) || [],
      negative: parsed.negative?.slice(0, 3) || [],
    };
  } catch {
    return { positive: [], negative: [] };
  }
}

function calcJapanScore(params: {
  totalReviews: number;
  reviewScore: number; // 0-9
  streamerCount: number;
  buyingSignalRate: number; // 0-1
}): number {
  const { totalReviews, reviewScore, streamerCount, buyingSignalRate } = params;

  // Review volume: 0-40pts
  let reviewVolume = 0;
  if (totalReviews >= 2000) reviewVolume = 40;
  else if (totalReviews >= 500) reviewVolume = 25;
  else if (totalReviews >= 100) reviewVolume = 15;
  else if (totalReviews >= 10) reviewVolume = 8;
  else reviewVolume = Math.min(totalReviews, 5);

  // Review score: 0-30pts
  const reviewQuality = Math.round((reviewScore / 9) * 30);

  // Twitch: 0-20pts
  let twitchScore = 0;
  if (streamerCount >= 20) twitchScore = 20;
  else if (streamerCount >= 10) twitchScore = 15;
  else if (streamerCount >= 5) twitchScore = 10;
  else if (streamerCount >= 2) twitchScore = 6;
  else if (streamerCount >= 1) twitchScore = 3;

  // Buying signals: 0-10pts
  const buyingScore = Math.round(buyingSignalRate * 10);

  return Math.min(reviewVolume + reviewQuality + twitchScore + buyingScore, 100);
}

export async function GET(req: NextRequest) {
  const steamId = req.nextUrl.searchParams.get('steam_id');
  const gameName = req.nextUrl.searchParams.get('game_name') || '';

  if (!steamId) {
    return NextResponse.json({ error: 'Missing ?steam_id=' }, { status: 400 });
  }

  try {
    const [reviews, appInfo, recentReviews, twitchGameId] = await Promise.all([
      getSteamReviews(steamId, 'japanese'),
      getSteamAppInfo(steamId),
      getRecentJapaneseReviews(steamId, 20),
      gameName ? getTwitchGameId(gameName) : Promise.resolve(null),
    ]);

    // Twitch: no language filter — get all streams
    const streams = twitchGameId
      ? await getStreamsForGame(twitchGameId, 20)
      : [];

    // JP streams only (language='ja') + fallback to all if none
    const jpStreams = streams.filter(s => s.language === 'ja');
    const displayStreams = jpStreams.length > 0 ? jpStreams : streams;

    // Buying signals
    const buyingKeywords = ['買', '購入', 'おすすめ', '面白', '最高', '神', 'はまった', '夢中'];
    const buyingReviews = recentReviews.filter(r =>
      buyingKeywords.some(k => r.review.includes(k))
    );
    const buyingSignalRate = recentReviews.length > 0
      ? buyingReviews.length / recentReviews.length
      : 0;

    // Score
    const japanScore = calcJapanScore({
      totalReviews: reviews?.total_reviews || 0,
      reviewScore: reviews?.review_score || 0,
      streamerCount: displayStreams.length,
      buyingSignalRate,
    });

    // Summarize reviews with AI
    const reviewsForSummary = recentReviews.slice(0, 15).map(r => ({
      text: r.review.slice(0, 200),
      positive: r.voted_up,
    }));
    const summary = await summarizeReviews(reviewsForSummary);

    // Top 5 streamers
    const topStreamers = displayStreams
      .sort((a, b) => b.viewer_count - a.viewer_count)
      .slice(0, 5)
      .map(s => ({
        name: s.user_name,
        viewers: s.viewer_count,
        title: s.title,
        language: s.language,
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
        score: reviews?.review_score || 0,
      },
      twitch: {
        active_streams: displayStreams.length,
        jp_streams: jpStreams.length,
        total_viewers: displayStreams.reduce((s, st) => s + st.viewer_count, 0),
        top_streamers: topStreamers,
      },
      buying_signals: buyingReviews.length,
      buying_signal_rate: Math.round(buyingSignalRate * 100),
      review_summary: summary,
      recent_reviews: recentReviews.slice(0, 5).map(r => ({
        text_ja: r.review.slice(0, 150),
        positive: r.voted_up,
        timestamp: r.timestamp,
      })),
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
