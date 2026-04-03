"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, TrendingUp, DollarSign, Users, BarChart2, Clock, Tv } from "lucide-react";
import Link from "next/link";

interface StreamerData {
  streamer: {
    username: string;
    display_name: string;
    description: string;
    profile_image: string;
    broadcaster_type: string;
    twitch_url: string;
    avg_concurrent_viewers: number;
    peak_concurrent_viewers: number;
    streams_per_week: string;
    total_hours_streamed: number;
    broadcasts_analyzed: number;
    viewer_note: string;
    genre_breakdown: { genre: string; count: number; ratio: number }[];
    game_avg_concurrent: number | null;
    game_broadcasts_count: number;
  };
  v_function: {
    v_score: number;
    tier: 'S' | 'A' | 'B' | 'C';
    cbi_index: number;
    interpretation: string;
    components: { reach: number; engagement: number; conversion: number; fit: number };
  };
  game_analysis: {
    game_name: string;
    game_broadcasts_last_30d: number;
    game_avg_concurrent: number | null;
    avg_attributed_reviews: number;
    conversion_evidence: number;
    efficiency_tier: string;
  };
  roi_estimate: {
    estimated_cost_jpy: number;
    estimated_purchases: { low: number; mid: number; high: number };
    cost_per_purchase_jpy: number | null;
    roi_note: string;
  };
  recent_broadcasts: {
    title: string;
    date: string;
    duration_minutes: number;
    vod_views: number;
    estimated_concurrent: number;
    twitch_url: string;
  }[];
}

const TIER_STYLE = {
  S: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'S — Top Converter', desc: 'Exceptional purchase conversion rate' },
  A: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'A — High Impact', desc: 'Strong conversion signal' },
  B: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'B — Moderate', desc: 'Average conversion rate' },
  C: { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', label: 'C — Low Signal', desc: 'Insufficient conversion data' },
};

export default function StreamerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const steamId = searchParams.get('steam_id') || '';
  const gameName = searchParams.get('game_name') || '';
  const liveViewers = searchParams.get('live_viewers') || '0';

  const [data, setData] = useState<StreamerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const url = `/api/clarity/streamer?username=${username}&steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}&live_viewers=${liveViewers}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, steamId, gameName, liveViewers]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Analyzing {username}...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error || 'Not found'}</p>
        <Link href="/clarity" className="text-blue-600 text-sm">← Back to J-Clarity</Link>
      </div>
    </div>
  );

  const tier = TIER_STYLE[data.v_function.tier as keyof typeof TIER_STYLE] || TIER_STYLE.C;
  const { roi_estimate: roi } = data;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href={`/clarity${steamId ? `?steam_id=${steamId}&game=${encodeURIComponent(gameName)}` : ''}`}
            className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-black text-sm">JP<span className="text-blue-600">RADAR</span> · J-Clarity</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">

        {/* Streamer header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-start gap-5">
            {data.streamer.profile_image && (
              <img src={data.streamer.profile_image} alt={data.streamer.display_name}
                className="w-20 h-20 rounded-full border-2 border-purple-200 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-black">{data.streamer.display_name}</h1>
                {data.streamer.broadcaster_type && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold capitalize">
                    {data.streamer.broadcaster_type}
                  </span>
                )}
                <a href={data.streamer.twitch_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-medium flex items-center gap-1 hover:bg-purple-700">
                  Twitch <ExternalLink size={10} />
                </a>
              </div>
              <p className="text-slate-400 text-sm mb-4 line-clamp-2">{data.streamer.description}</p>

              {/* Key stats (last 30 days) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Avg Concurrent', value: data.streamer.avg_concurrent_viewers.toLocaleString(), note: data.streamer.viewer_note, icon: <Users size={14} className="text-blue-500" /> },
                  { label: 'Peak Concurrent', value: data.streamer.peak_concurrent_viewers.toLocaleString(), note: 'estimated', icon: <TrendingUp size={14} className="text-emerald-500" /> },
                  { label: 'Streams / Week', value: data.streamer.streams_per_week, note: 'last 30 days', icon: <Tv size={14} className="text-purple-500" /> },
                  { label: 'Hours Streamed', value: `${data.streamer.total_hours_streamed}h`, note: 'last 30 days', icon: <Clock size={14} className="text-orange-500" /> },
                ].map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">{s.icon}<span className="text-slate-400 text-xs">{s.label}</span></div>
                    <div className="font-black text-lg">{s.value}</div>
                    <div className="text-slate-300 text-xs">{s.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Genre breakdown */}
        {data.streamer.genre_breakdown.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-black text-base mb-4 flex items-center gap-2">
              <BarChart2 size={16} className="text-blue-600" /> Content Breakdown (last 30 days)
            </h3>
            <div className="space-y-3">
              {data.streamer.genre_breakdown.map((g, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 w-36 shrink-0">{g.genre}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${g.ratio}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500 w-16 text-right">{g.ratio}% ({g.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game-specific performance */}
        {gameName && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-black text-base mb-4">📊 Performance: {gameName}</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Streams (30d)', value: data.game_analysis.game_broadcasts_last_30d || 0 },
                { label: 'Avg Concurrent', value: data.game_analysis.game_avg_concurrent ? data.game_analysis.game_avg_concurrent.toLocaleString() : 'N/A' },
                { label: 'Attributed Reviews', value: data.game_analysis.avg_attributed_reviews || 0 },
              ].map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-black">{s.value}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            {data.game_analysis.avg_attributed_reviews === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-700 text-xs">
                ⚠️ No conversion data for this game yet. Run a test campaign to measure real impact.
              </div>
            )}
          </div>
        )}

        {/* V-Function Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-base">V-Score — Purchasing Power</h3>
              <p className="text-slate-400 text-xs mt-0.5">{data.v_function.interpretation}</p>
            </div>
            <div className={`text-5xl font-black ${tier.color}`}>{data.v_function.v_score}</div>
          </div>

          <div className="space-y-3 mb-4">
            {[
              { label: 'Reach Efficiency', value: data.v_function.components.reach, max: 30, color: 'bg-blue-500', note: 'Category percentile' },
              { label: 'Conversion', value: data.v_function.components.conversion, max: 45, color: 'bg-emerald-500', note: 'Review delta per stream' },
              { label: 'Engagement', value: data.v_function.components.engagement, max: 25, color: 'bg-purple-500', note: 'Chat activity rate' },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 w-32 shrink-0">{c.label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((c.value / c.max) * 100, 100)}%` }}
                    transition={{ delay: i * 0.1, duration: 0.6 }}
                    className={`h-full ${c.color} rounded-full`}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 w-12 text-right">{c.value.toFixed(1)}/{c.max}</span>
              </div>
            ))}
          </div>

          <div className={`rounded-xl p-3 border ${tier.bg} flex items-center gap-3`}>
            <span className={`text-2xl font-black ${tier.color}`}>{data.v_function.tier}</span>
            <div>
              <div className={`font-bold text-sm ${tier.color}`}>{tier.label}</div>
              <div className="text-slate-400 text-xs">{tier.desc}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-slate-400">CBI Index</div>
              <div className={`font-black ${data.v_function.cbi_index >= 50 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {data.v_function.cbi_index}
              </div>
            </div>
          </div>
        </div>

        {/* ROI Estimate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-black text-base mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-yellow-600" /> ROI Estimate
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Conservative', value: roi.estimated_purchases.low, highlight: false },
              { label: 'Expected', value: roi.estimated_purchases.mid, highlight: true },
              { label: 'Optimistic', value: roi.estimated_purchases.high, highlight: false },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl p-4 text-center border ${s.highlight ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-2xl font-black ${s.highlight ? 'text-blue-700' : 'text-slate-700'}`}>~{s.value}</div>
                <div className="text-sm font-bold text-slate-500">{s.label}</div>
                <div className="text-slate-400 text-xs">purchases</div>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-500 flex justify-between items-center">
            <span><strong>Est. sponsorship:</strong> ¥{roi.estimated_cost_jpy.toLocaleString()}</span>
            <span><strong>Cost/purchase:</strong> {roi.cost_per_purchase_jpy ? `¥${roi.cost_per_purchase_jpy.toLocaleString()}` : '—'}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">* Estimates based on historical broadcast patterns. ±50% variance expected.</p>
        </div>

        {/* Recent broadcasts */}
        {data.recent_broadcasts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-black text-base mb-4">Recent Broadcasts (last 30 days)</h3>
            <div className="space-y-2">
              {data.recent_broadcasts.map((b, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{b.title}</div>
                    <div className="text-slate-400 text-xs">
                      {new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·
                      {b.duration_minutes}min · ~{b.estimated_concurrent.toLocaleString()} live viewers
                    </div>
                  </div>
                  <a href={b.twitch_url} target="_blank" rel="noopener noreferrer"
                    className="text-purple-500 hover:text-purple-700 shrink-0">
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
