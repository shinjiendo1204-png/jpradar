import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'Pokemon card Japanese rare';
  const sbKey = process.env.SCRAPINGBEE_KEY;
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=20`;

  const params = new URLSearchParams({
    api_key: sbKey!, url,
    render_js: 'true', premium_proxy: 'true', country_code: 'us',
  });
  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
  const html = await res.text();

  // Find first item URL and show 1000 chars around it
  const itmIdx = html.indexOf('ebay.com/itm/');
  const itmCtx = itmIdx >= 0 ? html.slice(itmIdx - 100, itmIdx + 1500) : 'NOT FOUND';

  // Try su-card blocks
  const cardBlocks = html.split('su-card-container').slice(1, 4);
  const firstCard = cardBlocks[0]?.slice(0, 1000) || 'NOT FOUND';

  return NextResponse.json({
    status: res.status,
    htmlLength: html.length,
    itmCtx,
    firstCard,
  });
}
