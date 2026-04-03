import { NextRequest, NextResponse } from 'next/server';

/**
 * Translate array of Japanese texts to English
 * POST { texts: string[] }
 */
export async function POST(req: NextRequest) {
  const { texts } = await req.json();
  if (!texts?.length) return NextResponse.json({ translations: [] });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ translations: texts });

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Translate each Japanese game review to natural English. Return a JSON array of strings in the same order. Keep it concise.',
          },
          {
            role: 'user',
            content: JSON.stringify(texts),
          },
        ],
        max_tokens: 500,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const translations = Array.isArray(parsed) ? parsed : (parsed.translations || parsed.reviews || texts);

    return NextResponse.json({ translations });
  } catch {
    return NextResponse.json({ translations: texts });
  }
}
