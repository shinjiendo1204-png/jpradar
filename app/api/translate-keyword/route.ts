import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { keyword } = await req.json();
  if (!keyword) return NextResponse.json({ error: "No keyword" }, { status: 400 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Convert this English marketing keyword to its most effective Japanese search terms for monitoring Japanese social media.

Keyword: "${keyword}"

Return JSON only:
{
  "japanese": "主要な日本語検索ワード",
  "alternatives": ["代替1", "代替2"]
}

If the keyword is already a known brand/product name used in Japan, use its katakana version. Return only valid JSON.`
        }]
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ japanese: keyword });
  }
}
