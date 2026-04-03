"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, TrendingUp, DollarSign, Users, Award, BarChart2 } from "lucide-react";
import Link from "next/link";

interface StreamerAnalysis {
  streamer: {
    username: string;
    display_name: string;
    description: string;
    profile_image: string;
    total_views: number;
    broadcaster_type: string;
    twitch_url: string;
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
    relevant_broadcasts: number;
    avg_view_count: number;
    avg_influence_score: number;
    efficiency_tier: 'S' | 'A' | 'B' | 'C' | 'unknown';
    best_broadcast: any;
    lag_curve_url: string | null;
  };
  roi_estimate: {
    estimated_cost_jpy: number;
    estimated_purchases: { low: number; mid: number; high: number };
    cost_per_purchase_jpy: number | null;
    roi_note: string;
  };
  recent_broadcasts: any[];
}

const TIER_CONFIG = {
  S: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'S — Top Converter', desc: 'Exceptional purchase conversion rate' },
  A: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'A — High Impact', desc: 'Strong purchase conversion' },
  B: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'B — Moderate Impact', desc: 'Average conversion rate' },
  C: { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', label: 'C — Low Conversion', desc: 'Low purchase conversion' },
  unknown: { color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200', label: '? — Insufficient Data', desc: 'Not enough broadcasts analyzed' },
};

export default function StreamerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const steamId = searchParams.get('steam_id') || '';
  const gameName = searchParams.get('game_name') || '';

  const [data, setData] = useState<StreamerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/clarity/streamer?username=${username}&steam_id=${steamId}&game_name=${encodeURIComponent(gameName)}`
        );
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
  }, [username, steamId, gameName]);

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
      <p className="text-red-500">{error || 'Not found'}</p>
    </div>
  );

  const tierKey = data.v_function?.tier || data.game_analysis.efficiency_tier || 'unknown';
  const tier = TIER_CONFIG[tierKey as keyof typeof TIER_CONFIG] || TIER_CONFIG.unknown;
  const { roi_estimate: roi } = data;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href={`/clarity?steam_id=${steamId}&game=${encodeURIComponent(gameName)}`}
            className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-black text-sm">JP<span className="text-blue-600">RADAR</span> · J-Clarity</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* Streamer header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-5">
          {data.streamer.profile_image && (
            <img src={data.streamer.profile_image} alt={data.streamer.display_name}
              className="w-20 h-20 rounded-full border-2 border-purple-200 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black">{data.streamer.display_name}</h1>
            <p className="text-slate-400 text-sm mb-3 truncate">{data.streamer.description?.slice(0, 100)}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(data.streamer as any).detected_genres?.map((g: string) => (
                <span key={g} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">{g}</span>
              ))}
              {data.streamer.broadcaster_type && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium capitalize">
                  {data.streamer.broadcaster_type}
                </span>
              )}
              <a href={data.streamer.twitch_url} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-medium flex items-center gap-1 hover:bg-purple-700">
                Twitch <ExternalLink size={10} />
              </a>
            </div>
            {/* Key stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Avg Viewers', value: (data.streamer as any).avg_view_count?.toLocaleString() || '—' },
                { label: 'Peak Viewers', value: (data.streamer as any).peak_view_count?.toLocaleString() || '—' },
                { label: 'Streams/Week', value: (data.streamer as any).streams_per_week || '—' },
                { label: 'Total Hours', value: (data.streamer as any).total_broadcast_hours || '—' },
              ].map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="font-black text-sm">{s.value}</div>
                  <div className="text-slate-400 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* V-Function Score */}
        {data.v_function && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-lg">V-Score (Purchasing Power)</h3>
                <p className="text-slate-400 text-xs mt-0.5">{data.v_function.interpretation}</p>
              </div>
              <div className={`text-5xl font-black ${tier.color}`}>{data.v_function.v_score}</div>
            </div>

            {/* Component bars */}
            <div className="space-y-3 mb-5">
              {[
                { label: 'Reach', value: data.v_function.components.reach, max: 5, color: 'bg-blue-500' },
                { label: 'Engagement', value: data.v_function.components.engagement, max: 5, color: 'bg-purple-500' },
                { label: 'Conversion', value: data.v_function.components.conversion, max: 5, color: 'bg-emerald-500' },
                { label: 'Genre Fit', value: data.v_function.components.fit, max: 5, color: 'bg-orange-500' },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-20 shrink-0">{c.label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((c.value / c.max) * 100, 100)}%` }}
                      transition={{ delay: i * 0.1, duration: 0.6 }}
                      className={`h-full ${c.color} rounded-full`}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-8 text-right">{c.value.toFixed(1)}</span>
                </div>
              ))}
            </div>

            {/* CBI */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">CBI — Chat Buy-Intent Index</div>
                  <div className="text-slate-400 text-xs">Purchase signals extracted from chat activity</div>
                </div>
                <div className={`text-2xl font-black ${
                  data.v_function.cbi_index >= 60 ? 'text-emerald-600' :
                  data.v_function.cbi_index >= 30 ? 'text-yellow-600' : 'text-slate-400'
                }`}>{data.v_function.cbi_index}</div>
              </div>
            </div>
          </div>
        )}

        {/* Efficiency tier badge */}
        <div className={`rounded-2xl p-4 border ${tier.bg} flex items-center gap-4`}>
          <div className={`text-3xl font-black ${tier.color}`}>{data.v_function?.tier || data.game_analysis.efficiency_tier}</div>
          <div>
            <div className={`font-black ${tier.color}`}>{tier.label}</div>
            <div className="text-slate-500 text-sm">{tier.desc}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Users size={16} className="text-blue-600" />, label: 'Avg Viewers', value: data.game_analysis.avg_view_count.toLocaleString() },
            { icon: <TrendingUp size={16} className="text-emerald-600" />, label: 'Influence Score', value: data.game_analysis.avg_influence_score.toFixed(1) },
            { icon: <BarChart2 size={16} className="text-purple-600" />, label: 'Broadcasts Analyzed', value: data.game_analysis.relevant_broadcasts },
            { icon: <DollarSign size={16} className="text-yellow-600" />, label: 'Est. Cost/Purchase', value: roi.cost_per_purchase_jpy ? `¥${roi.cost_per_purchase_jpy.toLocaleString()}` : 'N/A' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
              <div className="flex justify-center mb-2">{s.icon}</div>
              <div className="text-xl font-black">{s.value}</div>
              <div className="text-slate-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ROI Estimate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="font-black text-lg mb-4 flex items-center gap-2">
            <DollarSign size={18} className="text-yellow-600" /> ROI Estimate
          </h3>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Conservative', value: roi.estimated_purchases.low, note: 'low estimate' },
              { label: 'Expected', value: roi.estimated_purchases.mid, note: 'mid estimate', highlight: true },
              { label: 'Optimistic', value: roi.estimated_purchases.high, note: 'high estimate' },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl p-4 text-center border ${s.highlight ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-2xl font-black ${s.highlight ? 'text-blue-700' : 'text-slate-700'}`}>
                  ~{s.value}
                </div>
                <div className="text-sm font-bold text-slate-600">{s.label}</div>
                <div className="text-slate-400 text-xs">purchases ({s.note})</div>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-500">
            <strong>Est. sponsorship cost:</strong> ¥{roi.estimated_cost_jpy.toLocaleString()} ·{' '}
            <strong>Cost per purchase:</strong> {roi.cost_per_purchase_jpy ? `¥${roi.cost_per_purchase_jpy.toLocaleString()}` : 'N/A'}
            <p className="text-xs mt-1 text-slate-400">* Estimates based on historical broadcast performance and JP game streamer market rates.</p>
          </div>
        </div>

        {/* Recent broadcasts */}
        {data.recent_broadcasts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="font-black text-lg mb-4">Recent Broadcasts</h3>
            <div className="space-y-3">
              {data.recent_broadcasts.map((b, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{b.title}</div>
                    <div className="text-slate-400 text-xs">
                      {new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·
                      {b.duration_minutes}min · {b.view_count.toLocaleString()} views
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {b.influence_score > 0 && (
                      <div className="text-emerald-600 text-xs font-bold">
                        Score: {b.influence_score.toFixed(1)}
                      </div>
                    )}
                    {b.review_delta_24h > 0 && (
                      <div className="text-blue-600 text-xs">+{b.review_delta_24h} reviews</div>
                    )}
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
