"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, TrendingUp, Bell, LogOut, Zap, Radio, Trash2, Languages } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const MAX_KEYWORDS = 3;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/auth/login"; return; }
      setUser(user);
      await refreshKeywords(user.id);
      setLoading(false);
    }
    load();
  }, []);

  async function refreshKeywords(userId: string) {
    const { data: kws } = await supabase
      .from("jpradar_keywords")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setKeywords(kws || []);

    if (kws && kws.length > 0) {
      const ids = kws.map((k: any) => k.id);
      const { data: rpts } = await supabase
        .from("jpradar_reports")
        .select("*, jpradar_keywords(keyword)")
        .in("keyword_id", ids)
        .order("created_at", { ascending: false })
        .limit(10);
      setReports(rpts || []);
    } else {
      setReports([]);
    }
  }

  async function addKeyword() {
    if (!newKeyword.trim() || !user) return;
    if (keywords.length >= MAX_KEYWORDS) {
      setError(`Beta limit: ${MAX_KEYWORDS} keywords max. Remove one first.`);
      return;
    }
    setError("");
    setAdding(true);

    // Translate English keyword to Japanese for better monitoring
    let jpKeyword = newKeyword.trim();
    try {
      const res = await fetch("/api/translate-keyword", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword.trim() }),
      });
      const data = await res.json();
      if (data.japanese) jpKeyword = data.japanese;
    } catch {}

    await supabase.from("jpradar_keywords").insert({
      user_id: user.id,
      keyword: newKeyword.trim(),
      keyword_ja: jpKeyword,
      plan: "beta",
    });

    await refreshKeywords(user.id);
    setNewKeyword("");
    setAdding(false);
  }

  async function removeKeyword(id: string) {
    await supabase.from("jpradar_keywords").delete().eq("id", id);
    await refreshKeywords(user.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-black text-lg text-slate-900">JP<span className="text-blue-600">RADAR</span></Link>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm hidden md:block">{user?.email}</span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-2 text-sm">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-3xl font-black mb-1">Your Japan Intelligence</h1>
          <p className="text-slate-500 text-sm">Monitor Japanese social media in English. Reports delivered daily.</p>
        </motion.div>

        {/* Keywords */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-lg flex items-center gap-2">
              <Radio size={18} className="text-blue-600" /> Monitored Keywords
            </h2>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${keywords.length >= MAX_KEYWORDS ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500"}`}>
              {keywords.length}/{MAX_KEYWORDS} used
            </span>
          </div>

          {error && (
            <div className="bg-orange-50 border border-orange-200 text-orange-600 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              placeholder="e.g. 'your brand', 'AI productivity', 'competitor name'"
              disabled={keywords.length >= MAX_KEYWORDS}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={addKeyword}
              disabled={adding || keywords.length >= MAX_KEYWORDS}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black px-4 py-3 rounded-xl transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <Plus size={16} /> {adding ? "Adding..." : "Add"}
            </button>
          </div>

          {adding && (
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-3">
              <Languages size={14} className="animate-pulse" />
              Translating to Japanese for better monitoring...
            </div>
          )}

          {keywords.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
              <Radio size={24} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Add your first keyword to start monitoring Japan.</p>
              <p className="text-slate-300 text-xs mt-1">Enter in English — we'll find the Japanese equivalent automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {keywords.map((kw: any) => (
                  <motion.div
                    key={kw.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
                      <div>
                        <span className="font-bold text-slate-900">{kw.keyword}</span>
                        {kw.keyword_ja && kw.keyword_ja !== kw.keyword && (
                          <span className="ml-2 text-xs text-slate-400">→ monitoring: {kw.keyword_ja}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeKeyword(kw.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors p-1 rounded"
                    >
                      <Trash2 size={15} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Reports */}
        <div>
          <h2 className="font-black text-lg flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-600" /> Intelligence Reports
          </h2>

          {reports.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
              <Bell size={24} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Your first report will appear here tomorrow morning (JST 10:00).</p>
              {keywords.length === 0 && (
                <p className="text-slate-300 text-xs mt-2">Add a keyword first ↑</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((r: any) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                >
                  {/* Report header */}
                  <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500">
                        {new Date(r.report_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      {r.jpradar_keywords?.keyword && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                          {r.jpradar_keywords.keyword}
                        </span>
                      )}
                    </div>
                    {r.sentiment_score !== null && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        r.sentiment_score >= 70 ? "bg-green-100 text-green-600" :
                        r.sentiment_score >= 40 ? "bg-yellow-100 text-yellow-600" :
                        "bg-red-100 text-red-600"
                      }`}>
                        {r.sentiment_score}% Positive
                      </span>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Summary */}
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">What Japan is saying</div>
                      <p className="text-slate-700 text-sm leading-relaxed">{r.summary}</p>
                    </div>

                    {/* Action item */}
                    {r.action_item && (
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        <Zap size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-amber-600 mb-1">Recommended Action</div>
                          <p className="text-slate-700 text-xs leading-relaxed">{r.action_item}</p>
                        </div>
                      </div>
                    )}

                    {/* Top posts */}
                    {r.top_posts && r.top_posts.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Top Posts</div>
                        <div className="space-y-2">
                          {r.top_posts.map((post: any, i: number) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-bold">{post.platform}</span>
                              </div>
                              <p className="text-slate-600 text-xs leading-relaxed">{post.content_en || post.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
