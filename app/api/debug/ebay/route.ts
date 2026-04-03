import { NextRequest, NextResponse } from 'next/server';

// Temporary debug endpoint — delete after fixing
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'Pokemon card Japanese rare holographic';
  const sbKey = process.env.SCRAPINGBEE_KEY;
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=20&_sop=13`;

  const params = new URLSearchParams({
    api_key: sbKey!,
    url,
    render_js: 'false',
    premium_proxy: 'false',
    country_code: 'us',
  });
  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
  const html = await res.text();

  // Find h3 tags
  const h3All = html.match(/<h3[^>]*>[\s\S]{0,150}?<\/h3>/g)?.slice(0, 10) || [];
  
  // Find s-item__title
  const sItemTitle = html.match(/s-item__title[^>]*>[\s\S]{0,200}?</g)?.slice(0, 5) || [];
  
  // Find span with title class
  const spanTitles = html.match(/<span[^>]*class="[^"]*title[^"]*"[^>]*>[^<]{5,100}<\/span>/g)?.slice(0, 5) || [];

  const idx = html.indexOf('s-item__title');
  const snippet = idx >= 0 ? html.slice(idx - 20, idx + 400) : 'NOT FOUND';

  return NextResponse.json({
    status: res.status,
    htmlLength: html.length,
    h3All,
    sItemTitle,
    spanTitles,
    snippet,
  });
}
