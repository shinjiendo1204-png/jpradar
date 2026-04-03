"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Star, MessageCircle, ExternalLink, ArrowRight,
  BarChart2, Filter, Globe, Flame, Clock, Users, TrendingUp
} from "lucide-react";
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
  reviews: { total: number; positive: number; score_desc: string; score: number };
  twitch: {
    active_streams: number;
    jp_streams: number;
    total_viewers: number;
    top_streamers: { name: string; viewers: number; title: string; language: string; twitch_url: string }[];
  };
  buying_signals: number;
  buying_signal_rate: number;
  review_summary: {
    positive: { theme: string; count: number }[];
    negative: { theme: string; count: number }[];
  };
  recent_reviews: { text_ja: string; positive: boolean; timestamp: number }[];
  analyzed_at: string;
}

type TimeFilter = 'now' | '7d' | '30d';
type LangFilter = 'all' | 'ja';

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

function StreamerRow({ s, rank, steamId, gameName }: {
  s: any; rank: number; steamId: string; gameName: string;
}) {
  const isJP = s.language === 'ja';
  return (
    <Link
      href={`/clarity/streamer/${s.name}?steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}`}
      className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors"
    >
      <span className="text-slate-300 font-black text-sm w-6 shrink-0">#{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{s.name}</span>
          {isJP
            ? <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">🇯🇵 JP</span>
            : <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">🌍 {s.language?.toUpperCase()}</span>
          }
        </div>
        <div className="text-slate-400 text-xs truncate">{s.title}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-black text-sm">{s.viewers.toLocaleString()}</div>
        <div className="text-slate-400 text-xs">viewers</div>
      </div>
      <ExternalLink size={12} className="text-slate-300 shrink-0" />
    </Link>
  );
}

export default function ClarityPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [ranking, setRanking] = useState<any>(null);
  const [trending, setTrending] = useState<any[]>([]);
  const [topStreamers, setTopStreamers] = useState<any[]>([]);
  const [streamerGenre, setStreamerGenre] = useState('all');
  const [streamerGenres, setStreamerGenres] = useState<string[]>([]);
  const [translations, setTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [streamerResults, setStreamerResults] = useState<any[]>([]);
  const [searchMode, setSearchMode] = useState<'game' | 'streamer'>('game');
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'overview' | 'ranking'>('overview');
  const [langFilter, setLangFilter] = useState<LangFilter>('all');
  const [timeFilter] = useState<TimeFilter>('now');

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    fetch('/api/clarity/trending')
      .then(r => r.json())
      .then(d => setTrending(d.trending_jp_games || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/clarity/jp-streamers?genre=${streamerGenre}`)
      .then(r => r.json())
      .then(d => {
        setTopStreamers(d.streamers || []);
        if (d.available_genres) setStreamerGenres(['all', ...d.available_genres]);
      })
      .catch(() => {});
  }, [streamerGenre]);

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); setStreamerResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (searchMode === 'streamer') {
          const res = await fetch(`/api/clarity/search-streamer?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setStreamerResults(data.results || []);
          setSearchResults([]);
        } else {
          const res = await fetch(`/api/clarity/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setSearchResults(data.results || []);
          setStreamerResults([]);
        }
      } finally { setSearching(false); }
    }, 400);
  }, [query, searchMode]);

  async function analyze(game: GameSearchResult) {
    setSelectedGame(game);
    setSearchResults([]);
    setQuery(game.name);
    setLoading(true);
    setError("");
    setResult(null);
    setRanking(null);
    setTranslations([]);
    setActiveTab('overview');

    try {
      const res = await fetch(`/api/clarity/analyze?steam_id=${game.app_id}&game_name=${encodeURIComponent(game.name)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      fetch(`/api/clarity/ranking?steam_id=${game.app_id}&game_name=${encodeURIComponent(game.name)}`)
        .then(r => r.json()).then(setRanking).catch(() => {});

      const jaTexts = data.recent_reviews.map((r: any) => r.text_ja);
      if (jaTexts.length) {
        fetch('/api/clarity/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: jaTexts }),
        }).then(r => r.json()).then(d => setTranslations(d.translations || []));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Filtered streamers
  const filteredStreamers = result?.twitch.top_streamers.filter(s =>
    langFilter === 'all' || s.language === 'ja'
  ) || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="font-black text-lg">
            JP<span className="text-blue-600">RADAR</span>
            <span className="ml-2 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">StreamProof</span>
          </Link>

        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2">JP StreamProof</h1>
          <p className="text-slate-500">Measure the <strong>true incremental impact</strong> of Japanese streamers.<br />Not views. Not followers. Actual sales evidence.</p>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6" ref={searchRef}>
          {/* Mode toggle */}
          <div className="flex gap-1 mb-2">
            {(['game', 'streamer'] as const).map(mode => (
              <button key={mode} onClick={() => { setSearchMode(mode); setQuery(''); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                  searchMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'
                }`}>
                {mode === 'game' ? '🎮 Game' : '📺 Streamer'}
              </button>
            ))}
            <span className="ml-2 text-xs text-slate-400 self-center">Steam-based data only · Valorant/non-Steam games coming soon</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-3 shadow-sm">
            <Search size={18} className="text-slate-400 ml-3 shrink-0" />
            <input
              type="text" value={query}
              onChange={e => { setQuery(e.target.value); setSelectedGame(null); }}
              placeholder={searchMode === 'game' ? 'Search any Steam game...' : 'Search Twitch streamer name...'}
              className="flex-1 py-3 text-slate-900 placeholder-slate-400 focus:outline-none text-base"
            />
            {searching && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />}
          </div>

          <AnimatePresence>
            {/* Game results */}
            {searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden">
                {searchResults.map(game => (
                  <button key={game.app_id} onClick={() => analyze(game)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left">
                    {game.image && <img src={game.image} alt={game.name} className="w-10 h-8 object-cover rounded" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{game.name}</div>
                      <div className="text-slate-400 text-xs">Steam · {game.price}</div>
                    </div>
                    <ArrowRight size={14} className="text-slate-400 shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}
            {/* Streamer results */}
            {streamerResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden">
                {streamerResults.map((s: any) => (
                  <Link key={s.login}
                    href={`/clarity/streamer/${s.login}`}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    {s.thumbnail && <img src={s.thumbnail} alt={s.display_name} className="w-8 h-8 rounded-full object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm flex items-center gap-2">
                        {s.display_name}
                        {s.is_live && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">LIVE</span>}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {s.broadcaster_language === 'ja' ? '🇯🇵 ' : ''}{s.game_name || 'Twitch streamer'}
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-slate-400 shrink-0" />
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2-column home: Games + Streamers */}
        {!result && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-6 mb-8">

            {/* Left: Trending Games */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flame size={16} className="text-orange-500" />
                <span className="font-black text-sm">Hot on JP Twitch</span>
                <span className="text-xs text-slate-400 ml-auto">live · 15min</span>
              </div>
              {trending.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-8 animate-pulse">Loading...</div>
              ) : (
                <div className="space-y-1">
                  {trending.slice(0, 8).map((game, i) => (
                    <button key={i} onClick={async () => {
                        setQuery(game.game_name);
                        setLoading(true);
                        setResult(null);
                        try {
                          const res = await fetch(`/api/clarity/search?q=${encodeURIComponent(game.game_name)}`);
                          const d = await res.json();
                          if (d.results?.[0]) analyze(d.results[0]);
                          else setLoading(false);
                        } catch { setLoading(false); }
                      }}
                      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-orange-50 transition-colors text-left group">
                      <span className="text-slate-300 font-black text-xs w-5">#{game.rank}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm group-hover:text-orange-600 transition-colors truncate">{game.game_name}</div>
                        <div className="text-slate-400 text-xs">{game.jp_streamers} streamers · {game.jp_viewers?.toLocaleString()} viewers</div>
                      </div>
                      <span className="text-orange-500 text-xs font-bold shrink-0">{game.heat_score}🌡️</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Top JP Streamers by genre */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-purple-600" />
                <span className="font-black text-sm">🇯🇵 JP Streamers Now</span>
                <span className="text-xs text-slate-400 ml-auto">live</span>
              </div>
              {/* Genre filter */}
              <div className="flex flex-wrap gap-1 mb-3">
                {['all', 'FPS', 'RPG', 'Just Chatting', 'Survival', 'Horror'].map(g => (
                  <button key={g} onClick={() => setStreamerGenre(g)}
                    className={`text-xs px-2 py-1 rounded-full font-bold transition-colors border ${
                      streamerGenre === g ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                    {g === 'all' ? 'All' : g}
                  </button>
                ))}
              </div>
              {topStreamers.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-8 animate-pulse">Loading JP streamers...</div>
              ) : (
                <div className="space-y-1">
                  {topStreamers.slice(0, 8).map((s: any, i: number) => (
                    <Link key={i}
                      href={`/clarity/streamer/${s.username}?live_viewers=${s.viewer_count}`}
                      className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className="text-slate-300 font-black text-xs w-5">#{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{s.display_name}</div>
                        <div className="text-slate-400 text-xs truncate">{s.game_name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-xs">{s.viewer_count.toLocaleString()}</div>
                        <div className="text-slate-300 text-xs">¥{(s.estimated_cost_jpy/10000).toFixed(0)}万</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Analyzing <strong>{selectedGame?.name}</strong> in Japan market...</p>
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">{error}</div>}

        {result && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              {(['overview', 'ranking'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${tab === activeTab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {tab === 'overview' ? '📊 Overview' : '🏆 Streamer Ranking'}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && <>

              {/* Hero */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {result.header_image && (
                  <div className="relative h-40 overflow-hidden">
                    <img src={result.header_image} alt={result.game_name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-6 text-white">
                      <h2 className="text-2xl font-black">{result.game_name}</h2>
                    </div>
                  </div>
                )}
                <div className="p-5 flex items-center gap-5">
                  <ScoreRing score={result.japan_score} />
                  <div className="flex-1">
                    <div className="text-slate-400 text-xs mb-1">Japan Market Score</div>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border mb-3 ${result.japan_score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : result.japan_score >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      {result.japan_score >= 80 ? "🔥 Strong JP Market" : result.japan_score >= 60 ? "🟡 Growing in JP" : "⚠️ Low JP Presence"}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "JP Reviews", value: result.reviews.total.toLocaleString(), sub: result.reviews.score_desc },
                        { label: "JP Streams", value: result.twitch.jp_streams, sub: `${result.twitch.total_viewers.toLocaleString()} viewers` },
                        { label: "Buy Signals", value: `${result.buying_signal_rate}%`, sub: "of JP reviews" },
                      ].map((s, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-2.5 text-center">
                          <div className="text-lg font-black">{s.value}</div>
                          <div className="text-slate-500 text-xs">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Two column: Streamers + Reviews */}
              <div className="grid md:grid-cols-2 gap-5">

                {/* Active Streamers */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black flex items-center gap-2">
                      <BarChart2 size={16} className="text-purple-600" /> Active Streamers
                    </h3>
                    {/* Language filter */}
                    <div className="flex gap-1">
                      {(['all', 'ja'] as LangFilter[]).map(l => (
                        <button key={l} onClick={() => setLangFilter(l)}
                          className={`text-xs px-2 py-1 rounded-lg font-bold transition-colors ${langFilter === l ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          {l === 'all' ? '🌍 All' : '🇯🇵 JP Only'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filteredStreamers.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">No {langFilter === 'ja' ? 'JP ' : ''}streamers live right now.</p>
                  ) : (
                    filteredStreamers.map((s, i) => (
                      <StreamerRow key={i} s={s} rank={i + 1} steamId={result.steam_id} gameName={result.game_name} />
                    ))
                  )}
                  <button onClick={() => setActiveTab('ranking')}
                    className="w-full mt-3 text-xs text-blue-600 hover:text-blue-800 font-bold py-2">
                    View full ranking with ROI →
                  </button>
                </div>

                {/* Review Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="font-black flex items-center gap-2 mb-3">
                    <MessageCircle size={16} className="text-blue-600" /> JP Player Sentiment
                  </h3>
                  {result.review_summary && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-emerald-600 font-bold text-xs mb-2">👍 Players love</div>
                        <div className="space-y-1.5">
                          {result.review_summary.positive.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                              <span className="text-emerald-700 text-xs flex-1">{item.theme}</span>
                              <span className="text-emerald-400 text-xs font-bold shrink-0">{item.count}</span>
                            </div>
                          ))}
                          {result.review_summary.positive.length === 0 && <p className="text-slate-400 text-xs">Not enough data</p>}
                        </div>
                      </div>
                      <div>
                        <div className="text-red-600 font-bold text-xs mb-2">👎 Players dislike</div>
                        <div className="space-y-1.5">
                          {result.review_summary.negative.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                              <span className="text-red-600 text-xs flex-1">{item.theme}</span>
                              <span className="text-red-400 text-xs font-bold shrink-0">{item.count}</span>
                            </div>
                          ))}
                          {result.review_summary.negative.length === 0 && <p className="text-slate-400 text-xs">Not enough data</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent reviews bilingual */}
              {result.recent_reviews.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="font-black mb-3 text-sm flex items-center gap-2">
                    <Star size={14} className="text-yellow-500" /> Recent JP Reviews
                  </h3>
                  <div className="space-y-3">
                    {result.recent_reviews.slice(0, 4).map((r, i) => (
                      <div key={i} className={`rounded-xl border p-3 ${r.positive ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                        <div className="flex gap-2">
                          <span>{r.positive ? "👍" : "👎"}</span>
                          <div>
                            <p className="text-slate-700 text-sm">{r.text_ja}</p>
                            {translations[i] && <p className="text-slate-400 text-xs mt-1 italic">"{translations[i]}"</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>}

            {/* RANKING TAB */}
            {activeTab === 'ranking' && (
              <div className="space-y-4">
                {!ranking ? (
                  <div className="text-center py-12 text-slate-400 text-sm animate-pulse">Loading streamer ranking...</div>
                ) : <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-full">
                      🎮 Genre: {ranking.game_genre}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full">
                      {ranking.total_live_streams} streamers live · {ranking.total_concurrent_viewers?.toLocaleString()} viewers
                    </span>
                    {/* Language filter */}
                    <div className="flex gap-1 ml-auto">
                      {(['all', 'ja'] as LangFilter[]).map(l => (
                        <button key={l} onClick={() => setLangFilter(l)}
                          className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors border ${langFilter === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                          {l === 'all' ? '🌍 All' : '🇯🇵 JP Only'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {ranking.concurrent_warning && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-700 text-sm">
                      {ranking.concurrent_warning}
                    </div>
                  )}

                  {/* ROI disclaimer */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-700 text-xs">
                    <strong>About ROI estimates:</strong> Purchase estimates are based on historical stream-to-review correlation and JP game streamer market conversion rates (0.3%–1.5%). Actual results vary. Use as a directional guide, not a guarantee.
                  </div>

                  {(ranking.streamers || []).filter((s: any) => langFilter === 'all' || s.language === 'ja').length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                      <p className="text-slate-400">No {langFilter === 'ja' ? 'JP ' : ''}streamers found right now.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wide">
                        <div className="col-span-1">#</div>
                        <div className="col-span-3">Streamer</div>
                        <div className="col-span-2 text-right">Viewers</div>
                        <div className="col-span-2 text-center">Genre Match</div>
                        <div className="col-span-2 text-right">Est. Purchases</div>
                        <div className="col-span-2 text-right">Cost/Purchase</div>
                      </div>
                      {(ranking.streamers || [])
                        .filter((s: any) => langFilter === 'all' || s.language === 'ja')
                        .map((s: any, i: number) => (
                          <Link key={i} href={s.streamer_page_url}
                            className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors items-center">
                            <div className="col-span-1 text-slate-400 font-bold text-sm">#{i + 1}</div>
                            <div className="col-span-3 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {s.profile_image && <img src={s.profile_image} className="w-6 h-6 rounded-full shrink-0" />}
                                <span className="font-bold text-sm truncate">{s.username}</span>
                                {s.language === 'ja'
                                  ? <span className="text-xs shrink-0">🇯🇵</span>
                                  : <span className="text-xs text-slate-400 shrink-0">{s.language?.toUpperCase()}</span>
                                }
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-bold text-sm">{s.viewer_count.toLocaleString()}</div>
                            <div className="col-span-2 text-center">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.genre_match ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {s.genre_match ? '✅' : '—'}
                              </span>
                            </div>
                            <div className="col-span-2 text-right text-sm">
                              <span className="font-bold">{s.estimated_purchases?.mid || '?'}</span>
                              <span className="text-slate-400 text-xs"> est.</span>
                            </div>
                            <div className="col-span-2 text-right text-xs text-slate-500">
                              {s.estimated_cost_jpy ? `¥${Math.round(s.estimated_cost_jpy / (s.estimated_purchases?.mid || 1)).toLocaleString()}` : '—'}
                            </div>
                          </Link>
                        ))}
                    </div>
                  )}
                </>}
              </div>
            )}

          </motion.div>
        )}
      </div>
    </div>
  );
}
