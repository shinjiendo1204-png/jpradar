import { NextRequest, NextResponse } from 'next/server';

// Temporary debug endpoint — delete after fixing
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'Super Famicom game';
  const sbKey = process.env.SCRAPINGBEE_KEY;

  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=20`;

  let html = '';
  let fetchedVia = 'direct';

  if (sbKey) {
    const params = new URLSearchParams({
      api_key: sbKey,
      url,
      render_js: 'false',
      premium_proxy: 'false',
      country_code: 'us',
    });
    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
    html = await res.text();
    fetchedVia = `scrapingbee status=${res.status}`;
  } else {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' } });
    html = await res.text();
    fetchedVia = `direct status=${res.status}`;
  }

  const hasItems = html.includes('s-item');

  // Find price-related snippets
  const idx = html.indexOf('s-item__price');
  const priceSnippet = idx >= 0 ? html.slice(idx, idx + 300) : 'NOT FOUND';

  // Try multiple patterns
  const p1 = html.match(/class="s-item__price"[^>]*>([^<]+)</g)?.slice(0, 5) || [];
  const p2 = html.match(/\$[\d,]+\.\d{2}/g)?.slice(0, 5) || [];
  const p3 = html.match(/"price":\{"value":"[^"]+"/g)?.slice(0, 5) || [];

  return NextResponse.json({
    fetchedVia,
    htmlLength: html.length,
    hasItems,
    priceSnippet,
    pattern1_results: p1,
    pattern2_dollars: p2,
    pattern3_json: p3,
  });
}
