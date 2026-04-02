"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Plus, TrendingUp, Bell, LogOut, Zap, Radio } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/auth/login"; return; }
      setUser(user);
      const { data: kws } = await supabase.from("jpradar_keywords").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setKeywords(kws || []);
      if (kws && kws.length > 0) {
        const ids = kws.map((k: any) => k.id);
        const { data: rpts } = await supabase.from("jpradar_reports").select("*").in("keyword_id", ids).order("created_at", { ascending: false }).limit(10);
        setReports(rpts || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function addKeyword() {
    if (!newKeyword.trim() || !user) return;
    setAdding(true);
    await supabase.from("jpradar_keywords").insert({ user_id: user.id, keyword: newKeyword.trim(), plan: "beta" });
    const { data } = await supabase.from("jpradar_keywords").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setKeywords(data || []);
    setNewKeyword("");
    setAdding(false);
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
          <p className="text-slate-500 text-sm">Reports are generated daily. Add keywords to start monitoring.</p>
        </motion.div>

        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-lg flex items-center gap-2">
              <Radio size={18} className="text-blue-600" /> Monitored Keywords
            </h2>
            <span className="text-xs text-slate-400">{keywords.length}/3 used (Beta)</span>
          </div>

          <div className="flex gap-3 mb-4">
            <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              placeholder="e.g. 'AI SaaS', 'your brand name'"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm" />
            <button onClick={addKeyword} disabled={adding || keywords.length >= 3}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black px-4 py-3 rounded-xl transition-colors flex items-center gap-2 text-sm">
              <Plus size={16} /> {adding ? "Adding..." : "Add"}
            </button>
          </div>

          {keywords.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
              <Radio size={24} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Add your first keyword to start monitoring Japan.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keywords.map((kw: any) => (
                <div key={kw.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="font-bold text-slate-900">{kw.keyword}</span>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase font-bold">{kw.plan}</span>
                  </div>
                  <span className="text-xs text-slate-400">Monitoring active</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-black text-lg flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-600" /> Recent Reports
          </h2>

          {reports.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
              <Bell size={24} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Your first report will appear here tomorrow morning.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((r: any) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs text-slate-400">{new Date(r.report_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                    {r.sentiment_score && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.sentiment_score >= 70 ? "bg-green-100 text-green-600" : r.sentiment_score >= 40 ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                        {r.sentiment_score}% Positive
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 text-sm mb-3 leading-relaxed">{r.summary}</p>
                  {r.action_item && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <Zap size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700 text-xs">{r.action_item}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
