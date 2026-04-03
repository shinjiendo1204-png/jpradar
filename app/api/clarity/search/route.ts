import { NextRequest, NextResponse } from 'next/server';

/**
 * Search Steam games by name
 * GET /api/clarity/search?q=Valheim
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=US`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();

    const results = (data.items || []).slice(0, 5).map((item: any) => ({
      app_id: String(item.id),
      name: item.name,
      image: item.tiny_image,
      price: item.price?.final_formatted || 'Free',
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
