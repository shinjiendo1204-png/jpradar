import { NextRequest, NextResponse } from 'next/server';

// Temporary debug endpoint — shows raw surugaya HTML structure
export async function GET(req: NextRequest) {
  const sbKey = process.env.SCRAPINGBEE_KEY;
  const keyword = req.nextUrl.searchParams.get('q') || 'ファミコン ソフト';
  const url = `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(keyword)}&rankBy=new`;

  const params = new URLSearchParams({
    api_key: sbKey!,
    url,
    render_js: 'false',
    premium_proxy: 'true',
    country_code: 'jp',
  });

  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
  const html = await res.text();

  // Find product-related snippets
  const productLinks = html.match(/href="\/product\/detail\/[^"]+"/g)?.slice(0, 5) || [];
  
  // Find price patterns
  const prices = html.match(/[¥￥][\d,]+/g)?.slice(0, 10) || [];
  
  // Find title-like elements around product links
  const detailIdx = html.indexOf('/product/detail/');
  const surrounding = detailIdx >= 0 ? html.slice(Math.max(0, detailIdx - 200), detailIdx + 500) : 'NOT FOUND';

  // Find class names that appear near prices
  const priceContext = html.match(/class="[^"]*">[^<]*[¥￥][\d,]+/g)?.slice(0, 5) || [];

  // Show first item_detail block raw
  const blocks = html.split('<div class="item_detail">');
  const firstBlock = blocks[1]?.slice(0, 1500) || 'NOT FOUND';

  return NextResponse.json({
    status: res.status,
    htmlLength: html.length,
    blockCount: blocks.length - 1,
    firstBlock,
    prices,
    priceContext,
  });
}
