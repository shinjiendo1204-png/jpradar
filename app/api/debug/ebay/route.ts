import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'Pokemon card Japanese rare';
  const sbKey = process.env.SCRAPINGBEE_KEY;
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=20`;

  const params = new URLSearchParams({
    api_key: sbKey!,
    url,
    render_js: 'false',
    premium_proxy: 'false',
    country_code: 'us',
  });
  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
  const html = await res.text();

  // Dump a 2000-char slice from the middle where listings likely are
  const mid = Math.floor(html.length / 3);
  const slice1 = html.slice(mid, mid + 2000);

  // Find any anchor tags with item titles
  const anchors = html.match(/<a[^>]+title="([^"]{10,100})"/g)?.slice(0, 10) || [];

  // Find any li items
  const liCount = (html.match(/<li[^>]*srp-results/g) || []).length;

  // Raw search for price and nearby text
  const dollarIdx = html.indexOf('$75');
  const dollarCtx = dollarIdx >= 0 ? html.slice(dollarIdx - 300, dollarIdx + 100) : 'not found';

  return NextResponse.json({
    status: res.status,
    htmlLength: html.length,
    anchors,
    liCount,
    slice1,
    dollarCtx,
  });
}
