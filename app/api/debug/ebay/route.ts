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

  // Show first 2000 chars + price matches
  const priceMatches = html.match(/s-item__price[^>]*>[^<]*/g)?.slice(0, 10) || [];
  const hasLogin = html.includes('Sign in') || html.includes('ログイン');
  const hasItems = html.includes('s-item');

  return NextResponse.json({
    fetchedVia,
    htmlLength: html.length,
    first500: html.slice(0, 500),
    hasLoginWall: hasLogin,
    hasItems,
    priceMatches,
  });
}
