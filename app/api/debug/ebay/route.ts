import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'Pokemon card Japanese rare';
  const sbKey = process.env.SCRAPINGBEE_KEY;
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=10`;

  const params = new URLSearchParams({
    api_key: sbKey!, url,
    render_js: 'true', premium_proxy: 'true', country_code: 'us',
  });
  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
  const html = await res.text();

  // Find item listing area: look for /itm/ links and surrounding context
  const itmIdx = html.indexOf('/itm/');
  const itmCtx = itmIdx >= 0 ? html.slice(itmIdx - 500, itmIdx + 500) : 'NOT FOUND';

  // Try to find title by looking at text nodes near prices
  const priceIdx = html.indexOf('$');
  const priceCtx = priceIdx >= 0 ? html.slice(priceIdx - 500, priceIdx + 200) : 'NOT FOUND';

  // All unique class names in HTML (to understand structure)
  const classes = [...new Set(html.match(/class="([^"]+)"/g) || [])].slice(0, 30);

  return NextResponse.json({
    status: res.status,
    htmlLength: html.length,
    itmCtx,
    priceCtx,
    classes: classes.slice(0, 20),
  });
}
