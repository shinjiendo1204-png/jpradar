"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, Twitch, Star, MessageCircle, ExternalLink, ArrowRight } from "lucide-react";
import Link from "next/link";

interface AnalysisResult {
  steam_id: string;
  game_name: string;
  header_image: string;
  japan_score: number;
  reviews: {
    total: number;
    positive: number;
    score_desc: string;
  };
  twitch: {
    active_streams: number;
    total_viewers: number;
    top_streamers: {
      name: string;
      viewers: number;
      title: string;
      twitch_url: string;
    }[];
  };
  buying_signals: number;
  recent_reviews: {
    text: string;
    positive: boolean;
  }[];
  analyzed_at: string;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${score * 2.51} 251`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black">{score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

export default function ClarityPage() {
  const [steamId, setSteamId] = useState("");
  const [gameName, setGameName] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!steamId) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/clarity/analyze?steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="font-black text-lg">
            JP<span className="text-blue-600">RADAR</span>
            <span className="ml-2 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">J-Clarity</span>
          </Link>
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 text-sm">Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-4xl font-black mb-3">J-Clarity</h1>
          <p className="text-slate-500">How is your game performing in Japan?<br />Steam reviews + Twitch streams analyzed instantly.</p>
        </motion.div>

        {/* Search */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Steam App ID</label>
              <input
                type="text"
                value={steamId}
                onChange={e => setSteamId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && analyze()}
                placeholder="e.g. 892970"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
              <p className="text-slate-400 text-xs mt-1">Find it in the Steam store URL: /app/<strong>XXXXXX</strong>/</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Game Name (for Twitch)</label>
              <input
                type="text"
                value={gameName}
                onChange={e => setGameName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && analyze()}
                placeholder="e.g. Valheim"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            onClick={analyze}
            disabled={loading || !steamId}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? "Analyzing Japan market..." : <><Search size={16} /> Analyze Japan Market</>}
          </button>
        </div>

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {result.header_image && (
                <img src={result.header_image} alt={result.game_name} className="w-full h-40 object-cover" />
              )}
              <div className="p-6 flex items-center gap-6">
                <ScoreRing score={result.japan_score} />
                <div>
                  <h2 className="text-2xl font-black mb-1">{result.game_name}</h2>
                  <p className="text-slate-500 text-sm mb-3">Japan Market Score</p>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                    result.japan_score >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    result.japan_score >= 60 ? "bg-yellow-50 text-yellow-700 border border-yellow-200" :
                    "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    {result.japan_score >= 80 ? "🔥 Strong JP Market" :
                     result.japan_score >= 60 ? "🟡 Growing in JP" : "⚠️ Low JP Presence"}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: <Star size={16} className="text-yellow-500" />, label: "JP Reviews", value: result.reviews.total.toLocaleString(), sub: result.reviews.score_desc },
                { icon: <Twitch size={16} className="text-purple-600" />, label: "Live Streams", value: result.twitch.active_streams, sub: `${result.twitch.total_viewers} viewers` },
                { icon: <MessageCircle size={16} className="text-blue-600" />, label: "Buy Signals", value: result.buying_signals, sub: "in recent reviews" },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                  <div className="flex justify-center mb-2">{s.icon}</div>
                  <div className="text-2xl font-black">{s.value}</div>
                  <div className="text-slate-400 text-xs mt-1">{s.label}</div>
                  <div className="text-slate-300 text-xs">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Top streamers */}
            {result.twitch.top_streamers.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                  <Twitch size={18} className="text-purple-600" /> Active JP Streamers
                </h3>
                <div className="space-y-3">
                  {result.twitch.top_streamers.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{s.name}</div>
                        <div className="text-slate-400 text-xs truncate">{s.title}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm">{s.viewers.toLocaleString()}</div>
                        <div className="text-slate-400 text-xs">viewers</div>
                      </div>
                      <a href={s.twitch_url} target="_blank" rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-800">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent reviews */}
            {result.recent_reviews.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="font-black text-lg mb-4">Recent JP Reviews</h3>
                <div className="space-y-3">
                  {result.recent_reviews.map((r, i) => (
                    <div key={i} className={`p-3 rounded-xl text-sm ${r.positive ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                      <span className="mr-2">{r.positive ? "👍" : "👎"}</span>
                      {r.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-slate-900 rounded-2xl p-6 text-center text-white">
              <h3 className="font-black text-lg mb-2">Want to find the right JP streamer for your game?</h3>
              <p className="text-slate-400 text-sm mb-4">J-Clarity Pro identifies which streamers drive actual purchases in Japan.</p>
              <Link href="/pricing" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                Upgrade to Pro <ArrowRight size={14} />
              </Link>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
