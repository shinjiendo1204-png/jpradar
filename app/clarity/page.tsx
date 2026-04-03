"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, Star, MessageCircle, ExternalLink, ArrowRight, Users, BarChart2 } from "lucide-react";
import Link from "next/link";

interface GameSearchResult {
  app_id: string;
  name: string;
  image: string;
  price: string;
}

interface AnalysisResult {
  steam_id: string;
  game_name: string;
  header_image: string;
  japan_score: number;
  reviews: { total: number; positive: number; score_desc: string };
  twitch: {
    active_streams: number;
    total_viewers: number;
    top_streamers: { name: string; viewers: number; title: string; twitch_url: string }[];
  };
  buying_signals: number;
  recent_reviews: { text_ja: string; text_en: string; positive: boolean; timestamp: number }[];
  analyzed_at: string;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${score * 2.51} 251`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black">{score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

// Simple bar chart for streamer contribution
function StreamerChart({ streamers, steamId = '', gameName = '' }: {
  streamers: AnalysisResult['twitch']['top_streamers'];
  steamId?: string;
  gameName?: string;
}) {
  if (!streamers.length) return null;
  const max = Math.max(...streamers.map(s => s.viewers), 1);
  return (
    <div className="space-y-3">
      {streamers.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <Link
            href={`/clarity/streamer/${s.name}?steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}`}
            className="w-28 text-xs font-bold text-purple-600 hover:text-purple-800 truncate shrink-0 hover:underline"
          >{s.name}</Link>
          <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(s.viewers / max) * 100}%` }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="h-full bg-purple-500 rounded-full"
            />
            <span className="absolute right-2 top-0 bottom-0 flex items-center text-xs font-bold text-slate-600">
              {s.viewers} viewers
            </span>
          </div>
          <a href={s.twitch_url} target="_blank" rel="noopener noreferrer"
            className="text-purple-500 hover:text-purple-700 shrink-0">
            <ExternalLink size={12} />
          </a>
        </div>
      ))}
    </div>
  );
}

export default function ClarityPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [ranking, setRanking] = useState<any>(null);
  const [translations, setTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'overview' | 'ranking'>('overview');
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  // Search as user types
  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/clarity/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query]);

  async function analyze(game: GameSearchResult) {
    setSelectedGame(game);
    setSearchResults([]);
    setQuery(game.name);
    setLoading(true);
    setError("");
    setResult(null);
    setTranslations([]);
    setRanking(null);
    setActiveTab('overview');

    try {
      const res = await fetch(`/api/clarity/analyze?steam_id=${game.app_id}&game_name=${encodeURIComponent(game.name)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      // Load ranking in parallel
      fetch(`/api/clarity/ranking?steam_id=${game.app_id}&game_name=${encodeURIComponent(game.name)}`)
        .then(r => r.json()).then(setRanking).catch(() => {});

      // Translate reviews
      const jaTexts = data.recent_reviews.map((r: any) => r.text_ja);
      if (jaTexts.length) {
        const tRes = await fetch('/api/clarity/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: jaTexts }),
        });
        const tData = await tRes.json();
        setTranslations(tData.translations || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="font-black text-lg">
            JP<span className="text-blue-600">RADAR</span>
            <span className="ml-2 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">J-Clarity</span>
          </Link>
          <Link href="/dashboard" className="text-slate-500 text-sm hover:text-slate-900">Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-4xl font-black mb-3">J-Clarity</h1>
          <p className="text-slate-500 text-lg">How is your game performing in Japan?</p>
          <p className="text-slate-400 text-sm mt-1">Steam reviews + Twitch streamers analyzed instantly.</p>
        </motion.div>

        {/* Search */}
        <div className="relative mb-8" ref={searchRef}>
          <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-3 shadow-sm">
            <Search size={18} className="text-slate-400 ml-3 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedGame(null); }}
              placeholder="Search any game on Steam..."
              className="flex-1 py-3 text-slate-900 placeholder-slate-400 focus:outline-none text-base"
            />
            {searching && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />}
          </div>

          {/* Dropdown */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden"
              >
                {searchResults.map(game => (
                  <button
                    key={game.app_id}
                    onClick={() => analyze(game)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                  >
                    {game.image && <img src={game.image} alt={game.name} className="w-10 h-8 object-cover rounded" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{game.name}</div>
                      <div className="text-slate-400 text-xs">App ID: {game.app_id} · {game.price}</div>
                    </div>
                    <ArrowRight size={14} className="text-slate-400 shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Analyzing Japan market for <strong>{selectedGame?.name}</strong>...</p>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">{error}</div>}

        {/* Results */}
        {result && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              {(['overview', 'ranking'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors capitalize ${
                    activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {tab === 'overview' ? '📊 Overview' : '🏆 Streamer Ranking'}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {activeTab === 'overview' && <>

            {/* Hero card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {result.header_image && (
                <div className="relative h-44 overflow-hidden">
                  <img src={result.header_image} alt={result.game_name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-6 text-white">
                    <h2 className="text-2xl font-black">{result.game_name}</h2>
                  </div>
                </div>
              )}
              <div className="p-6 flex items-center gap-6">
                <ScoreRing score={result.japan_score} />
                <div className="flex-1">
                  <div className="text-slate-500 text-sm mb-2">Japan Market Score</div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border mb-3 ${
                    result.japan_score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    result.japan_score >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {result.japan_score >= 80 ? "🔥 Strong JP Market" :
                     result.japan_score >= 60 ? "🟡 Growing in JP" : "⚠️ Low JP Presence"}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "JP Reviews", value: result.reviews.total.toLocaleString(), sub: result.reviews.score_desc },
                      { label: "Live Streams", value: result.twitch.active_streams, sub: `${result.twitch.total_viewers} viewers` },
                      { label: "Buy Signals", value: result.buying_signals, sub: "in reviews" },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                        <div className="text-xl font-black">{s.value}</div>
                        <div className="text-slate-400 text-xs">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Streamer chart */}
            {result.twitch.top_streamers.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="font-black text-lg mb-1 flex items-center gap-2">
                  <BarChart2 size={18} className="text-purple-600" /> JP Streamer Activity
                </h3>
                <p className="text-slate-400 text-xs mb-5">Click a streamer to see their ROI analysis</p>
                <StreamerChart
                  streamers={result.twitch.top_streamers}
                  steamId={result.steam_id}
                  gameName={result.game_name}
                />
                <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-purple-700 text-xs font-medium">
                    💡 <strong>Pro tip:</strong> Streamers with smaller but engaged audiences often drive more purchases than mega-streamers. Upgrade to Pro to see purchase conversion estimates.
                  </p>
                </div>
              </div>
            )}

            {/* Review Summary */}
            {(result as any).review_summary && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="font-black text-lg mb-1 flex items-center gap-2">
                  <MessageCircle size={18} className="text-blue-600" /> What JP Players Are Saying
                </h3>
                <p className="text-slate-400 text-xs mb-5">AI summary of recent Japanese reviews</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-emerald-600 font-bold text-sm mb-3 flex items-center gap-1">👍 Players love</div>
                    <div className="space-y-2">
                      {((result as any).review_summary.positive || []).map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100">
                          <span className="text-emerald-600 text-sm flex-1">{item.theme}</span>
                          <span className="text-emerald-400 text-xs font-bold">{item.count} mentions</span>
                        </div>
                      ))}
                      {((result as any).review_summary.positive || []).length === 0 && (
                        <p className="text-slate-400 text-sm">Not enough data</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-red-600 font-bold text-sm mb-3 flex items-center gap-1">👎 Players dislike</div>
                    <div className="space-y-2">
                      {((result as any).review_summary.negative || []).map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                          <span className="text-red-600 text-sm flex-1">{item.theme}</span>
                          <span className="text-red-400 text-xs font-bold">{item.count} mentions</span>
                        </div>
                      ))}
                      {((result as any).review_summary.negative || []).length === 0 && (
                        <p className="text-slate-400 text-sm">Not enough data</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-slate-900 rounded-2xl p-6 text-center text-white">
              <h3 className="font-black text-lg mb-2">Find the right JP streamers for your game</h3>
              <p className="text-slate-400 text-sm mb-4">J-Clarity Pro tracks which streamers actually drive purchases — not just views.</p>
              <Link href="/pricing" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                Upgrade to Pro <ArrowRight size={14} />
              </Link>
            </div>

            </> /* end overview tab */}

            {/* Ranking tab */}
            {activeTab === 'ranking' && (
              <div className="space-y-4">
                {!ranking ? (
                  <div className="text-center py-12 text-slate-400 text-sm animate-pulse">Loading streamer ranking...</div>
                ) : (
                  <>
                    {/* Genre + warning */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-full">
                        🎮 Genre: {ranking.game_genre}
                      </span>
                      <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full">
                        {ranking.total_live_streams} streamers live · {ranking.total_concurrent_viewers?.toLocaleString()} total viewers
                      </span>
                    </div>

                    {ranking.concurrent_warning && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-700 text-sm">
                        {ranking.concurrent_warning}
                      </div>
                    )}

                    {/* Streamer list */}
                    {(ranking.streamers || []).length === 0 ? (
                      <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                        <p className="text-slate-400">No active streamers found for this game right now.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(ranking.streamers || []).map((s: any, i: number) => (
                          <Link key={i} href={s.streamer_page_url}
                            className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow block">
                            <div className="text-slate-400 font-black w-6 text-center text-sm">#{i + 1}</div>
                            {s.profile_image && (
                              <img src={s.profile_image} alt={s.username}
                                className="w-10 h-10 rounded-full border border-slate-200 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm">{s.username}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                                  s.genre_match
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>{s.genre_match_label}</span>
                              </div>
                              <div className="text-slate-400 text-xs truncate mt-0.5">{s.stream_title}</div>
                              {s.specializes_in?.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {s.specializes_in.map((g: string, j: number) => (
                                    <span key={j} className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{g}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-black text-sm">{s.viewer_count.toLocaleString()}</div>
                              <div className="text-slate-400 text-xs">viewers</div>
                              <div className="text-slate-300 text-xs mt-1">{s.viewer_share_pct}% share</div>
                            </div>
                            <ExternalLink size={14} className="text-slate-300 shrink-0" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </motion.div>
        )}
      </div>
    </div>
  );
}
