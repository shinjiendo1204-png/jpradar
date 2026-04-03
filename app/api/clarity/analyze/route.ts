import { NextRequest, NextResponse } from 'next/server';
import { getSteamReviews, getSteamReviewsAll, getSteamAppInfo, getRecentJapaneseReviews } from '@/lib/steam';
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
Focus on SPECIFIC, MEANINGFUL feedback (gameplay mechanics, community, content, performance) — NOT vague praise or simple insults.
Return JSON exactly like:
{
  "positive": [{"theme": "Insightful English summary", "count": N}, ...],
  "negative": [{"theme": "Insightful English summary", "count": N}, ...]
}
Estimate counts. Each theme must be a complete English sentence fragment (6-10 words). Skip generic comments like "fun game" or "bad game".`,
          },
          { role: 'user', content: texts },
        ],
        max_tokens: 400,
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
  totalReviews: number;      // all languages
  reviewScore: number;       // 0-9 all languages
  jpPositiveRate: number;    // 0-1 JP reviews positive ratio
  jpReviewCount: number;     // JP review count
  streamerCount: number;
}): number {
  const { totalReviews, reviewScore, jpPositiveRate, jpReviewCount, streamerCount } = params;

  // Market size (all languages): 0-30pts
  let marketScore = 0;
  if (totalReviews >= 100000) marketScore = 30;
  else if (totalReviews >= 10000) marketScore = 22;
  else if (totalReviews >= 1000) marketScore = 15;
  else if (totalReviews >= 100) marketScore = 8;
  else marketScore = Math.min(totalReviews / 10, 5);

  // Global review quality: 0-25pts
  const qualityScore = Math.round((reviewScore / 9) * 25);

  // JP sentiment: 0-25pts (based on JP reviews positive ratio)
  let jpScore = 0;
  if (jpReviewCount >= 10) {
    jpScore = Math.round(jpPositiveRate * 25);
  } else if (jpReviewCount > 0) {
    jpScore = Math.round(jpPositiveRate * 10); // low confidence
  }

  // Twitch JP streamers: 0-20pts
  let twitchScore = 0;
  if (streamerCount >= 50) twitchScore = 20;
  else if (streamerCount >= 20) twitchScore = 15;
  else if (streamerCount >= 10) twitchScore = 10;
  else if (streamerCount >= 5) twitchScore = 7;
  else if (streamerCount >= 2) twitchScore = 4;
  else if (streamerCount >= 1) twitchScore = 2;

  return Math.min(marketScore + qualityScore + jpScore + twitchScore, 100);
}

export async function GET(req: NextRequest) {
  const steamId = req.nextUrl.searchParams.get('steam_id');
  const gameName = req.nextUrl.searchParams.get('game_name') || '';

  if (!steamId) {
    return NextResponse.json({ error: 'Missing ?steam_id=' }, { status: 400 });
  }

  try {
    const [reviews, reviewsAll, appInfo, recentReviews, twitchGameId] = await Promise.all([
      getSteamReviews(steamId, 'japanese'),
      getSteamReviewsAll(steamId),
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

    // JP sentiment rate
    const jpTotal = (reviews?.total_positive || 0) + (reviews?.total_negative || 0) || reviews?.total_reviews || 0;
    const jpPositiveRate = jpTotal > 0 ? (reviews?.total_positive || 0) / jpTotal : 0;

    // Score
    const japanScore = calcJapanScore({
      totalReviews: reviewsAll?.total || 0,
      reviewScore: reviewsAll?.score ?? reviews?.review_score ?? 0,
      jpPositiveRate,
      jpReviewCount: reviews?.total_reviews || 0,
      streamerCount: displayStreams.length,
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
