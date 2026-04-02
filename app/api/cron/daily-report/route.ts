import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Called daily by Vercel Cron
export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active keywords
  const { data: keywords } = await supabase
    .from("jpradar_keywords")
    .select("*, jpradar_subscriptions!inner(status)")
    .eq("active", true);

  if (!keywords || keywords.length === 0) {
    return NextResponse.json({ message: "No keywords to process" });
  }

  const results = [];

  for (const kw of keywords) {
    try {
      // Search X JP for the keyword
      const searchUrl = `https://nitter.net/search?q=${encodeURIComponent(kw.keyword + " lang:ja")}&f=tweets`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
      });
      const html = await res.text();

      // Extract text content (simplified)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 3000);

      // Generate report with Claude
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `You are a Japan market intelligence analyst. Based on this Japanese social media content about "${kw.keyword}", write a brief English intelligence report.

Content: ${textContent}

Return JSON with these fields:
- summary: 2-3 sentence executive summary in English
- sentiment_score: number 0-100 (percentage positive)
- action_item: one specific recommended action for a foreign marketer

Return only valid JSON, no markdown.`
          }]
        }),
      });

      const claudeData = await claudeRes.json();
      let report = { summary: "Report generation in progress.", sentiment_score: 50, action_item: "Check back tomorrow for your first full report." };

      try {
        const text = claudeData.content?.[0]?.text || "{}";
        report = JSON.parse(text);
      } catch {}

      // Save report
      await supabase.from("jpradar_reports").insert({
        keyword_id: kw.id,
        report_date: new Date().toISOString().split("T")[0],
        summary: report.summary,
        sentiment_score: report.sentiment_score,
        action_item: report.action_item,
        top_posts: [],
      });

      results.push({ keyword: kw.keyword, status: "success" });
    } catch (err) {
      results.push({ keyword: kw.keyword, status: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
