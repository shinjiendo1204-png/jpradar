"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Bell, TrendingUp, ExternalLink,
  DollarSign, Package, Zap, Plus, Trash2, ArrowRight, Crown
} from "lucide-react";
import Link from "next/link";

type Plan = "free" | "hunter" | "pro";

type Deal = {
  id: string;
  title_ja: string;
  title_en: string;
  source: string;
  source_url: string;
  image_url?: string;
  buy_price_jpy: number;
  shipping_estimate_jpy: number;
  ebay_sell_price_usd: number;
  net_profit_usd: number;
  profit_margin_pct: number;
  category: string;
  created_at: string;
};

type Alert = {
  id: string;
  category: string | null;
  min_profit_usd: number;
  slack_webhook_url: string | null;
  discord_webhook_url: string | null;
  is_active: boolean;
};

const CATEGORIES = [
  { value: null, label: "All categories" },
  { value: "game", label: "🎮 Retro Games" },
  { value: "card", label: "🃏 Trading Cards" },
  { value: "figure", label: "🗿 Figures" },
  { value: "brand", label: "👜 Branded Goods" },
  { value: "electronics", label: "💻 Electronics" },
  { value: "other", label: "📦 Other" },
];

const TIER_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  excellent: { label: "🔥 Hot",  bg: "bg-red-50 border-red-200",       text: "text-red-600" },
  high:      { label: "💚 Good", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  medium:    { label: "🟡 Fair", bg: "bg-yellow-50 border-yellow-200",  text: "text-yellow-700" },
  low:       { label: "⚪ Low",  bg: "bg-slate-50 border-slate-200",    text: "text-slate-500" },
};

const PLAN_LIMITS: Record<Plan, { dailyAlerts: number; webhooks: boolean; label: string }> = {
  free:   { dailyAlerts: 5,         webhooks: false, label: "Free" },
  hunter: { dailyAlerts: Infinity,  webhooks: true,  label: "Hunter" },
  pro:    { dailyAlerts: Infinity,  webhooks: true,  label: "Pro" },
};

function getTier(profit: number) {
  if (profit >= 80) return "excellent";
  if (profit >= 30) return "high";
  if (profit >= 10) return "medium";
  return "low";
}

// Upgrade banner shown to non-pro users
function UpgradeBanner({ plan }: { plan: Plan }) {
  if (plan === "pro") return null;
  const isHunter = plan === "hunter";
  return (
    <div className={`rounded-2xl p-4 mb-6 flex items-center justify-between gap-4 border ${isHunter ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}`}>
      <div className="flex items-center gap-3">
        <Crown size={18} className={isHunter ? "text-purple-600" : "text-blue-600"} />
        <div>
          <div className={`font-bold text-sm ${isHunter ? "text-purple-900" : "text-blue-900"}`}>
            {isHunter
              ? "Upgrade to Pro — Priority alerts, analytics & CSV export"
              : "Upgrade to Hunter — Unlimited alerts + Slack & Discord"}
          </div>
          <div className={`text-xs mt-0.5 ${isHunter ? "text-purple-600" : "text-blue-600"}`}>
            {isHunter ? "Starting at $79/month" : "Starting at $29/month"}
          </div>
        </div>
      </div>
      <Link
        href="/pricing"
        className={`shrink-0 flex items-center gap-1 font-bold text-sm px-4 py-2 rounded-xl transition-colors ${isHunter ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
      >
        Upgrade <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"deals" | "alerts">("deals");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [upgradedToast, setUpgradedToast] = useState(false);

  // Alert form
  const [newAlert, setNewAlert] = useState({
    category: null as string | null,
    min_profit_usd: 20,
    slack_webhook_url: "",
    discord_webhook_url: "",
  });
  const [savingAlert, setSavingAlert] = useState(false);
  const [alertError, setAlertError] = useState("");

  useEffect(() => {
    // Show toast if redirected from Stripe success
    if (window.location.search.includes("upgraded=1")) {
      setUpgradedToast(true);
      setTimeout(() => setUpgradedToast(false), 5000);
      window.history.replaceState({}, "", "/dashboard");
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/auth/login"; return; }
      setUser(user);

      const [{ data: profile }, { data: dealsData }, { data: alertsData }] = await Promise.all([
        supabase.from("profiles").select("plan").eq("id", user.id).single(),
        supabase.from("deals").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(50),
        supabase.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (profile?.plan) setPlan(profile.plan as Plan);
      setDeals(dealsData || []);
      setAlerts(alertsData || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function saveAlert() {
    if (plan === "free") {
      window.location.href = "/pricing";
      return;
    }
    if (!newAlert.slack_webhook_url && !newAlert.discord_webhook_url) {
      setAlertError("Add at least one Slack or Discord webhook URL.");
      return;
    }
    setSavingAlert(true);
    setAlertError("");

    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      category: newAlert.category,
      min_profit_usd: newAlert.min_profit_usd,
      slack_webhook_url: newAlert.slack_webhook_url || null,
      discord_webhook_url: newAlert.discord_webhook_url || null,
    });

    if (error) {
      setAlertError(error.message);
    } else {
      const { data } = await supabase.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setAlerts(data || []);
      setNewAlert({ category: null, min_profit_usd: 20, slack_webhook_url: "", discord_webhook_url: "" });
    }
    setSavingAlert(false);
  }

  async function deleteAlert(id: string) {
    await supabase.from("alerts").delete().eq("id", id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  const planLimits = PLAN_LIMITS[plan];
  const visibleDeals = plan === "free" ? deals.slice(0, 5) : deals;
  const filteredDeals = filterCategory
    ? visibleDeals.filter(d => d.category === filterCategory)
    : visibleDeals;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Upgrade toast */}
      <AnimatePresence>
        {upgradedToast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg text-sm"
          >
            🎉 Plan upgraded! Welcome aboard.
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="font-black text-lg">
            JP<span className="text-blue-600">RADAR</span>
          </Link>
          <div className="flex items-center gap-4">
            {/* Plan badge */}
            <Link href="/pricing" className={`text-xs font-black px-3 py-1 rounded-full border transition-colors ${
              plan === "pro"    ? "bg-purple-100 text-purple-700 border-purple-200" :
              plan === "hunter" ? "bg-blue-100 text-blue-700 border-blue-200" :
              "bg-slate-100 text-slate-500 border-slate-200 hover:border-blue-300"
            }`}>
              {plan === "free" ? "Free — Upgrade" : `${planLimits.label} Plan`}
            </Link>
            <span className="text-slate-400 text-sm hidden md:block">{user?.email}</span>
            <button onClick={handleLogout} className="text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1.5 text-sm">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Upgrade banner */}
        <UpgradeBanner plan={plan} />

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: <TrendingUp size={18} className="text-blue-600" />, label: "Deals Found", value: deals.length, sub: "last 30 days" },
            { icon: <DollarSign size={18} className="text-emerald-600" />, label: "Best Profit", value: deals.length > 0 ? `$${Math.max(...deals.map(d => d.net_profit_usd)).toFixed(0)}` : "—", sub: "single deal" },
            { icon: <Zap size={18} className="text-yellow-500" />, label: "Hot Deals 🔥", value: deals.filter(d => d.net_profit_usd >= 80).length, sub: ">$80 profit" },
            { icon: <Bell size={18} className="text-purple-600" />, label: "Active Alerts", value: alerts.filter(a => a.is_active).length, sub: plan === "free" ? "upgrade to add" : "webhooks" },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">{stat.icon}<span className="text-xs text-slate-400">{stat.label}</span></div>
              <div className="text-2xl font-black">{stat.value}</div>
              <div className="text-slate-400 text-xs mt-1">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-8">
          {(["deals", "alerts"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t === "deals" ? `📦 Deals (${deals.length})` : `🔔 Alerts (${alerts.length})`}
            </button>
          ))}
        </div>

        {/* DEALS TAB */}
        {tab === "deals" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map(cat => (
                <button key={cat.value ?? "all"} onClick={() => setFilterCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${filterCategory === cat.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {filteredDeals.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center">
                <Package size={32} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold mb-2">No deals yet</p>
                <p className="text-slate-400 text-sm">The scanner runs daily. Check back tomorrow.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <AnimatePresence>
                    {filteredDeals.map((deal, i) => {
                      const tier = getTier(deal.net_profit_usd);
                      const tc = TIER_CONFIG[tier];
                      return (
                        <motion.div key={deal.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="shrink-0 text-center md:w-28">
                            <div className={`text-2xl font-black ${tc.text}`}>+${deal.net_profit_usd.toFixed(0)}</div>
                            <div className="text-slate-400 text-xs">{deal.profit_margin_pct?.toFixed(0)}% margin</div>
                            <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full border ${tc.bg} ${tc.text}`}>{tc.label}</span>
                          </div>
                          <div className="hidden md:block w-px bg-slate-100 self-stretch" />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 text-sm mb-0.5 truncate">{deal.title_en || deal.title_ja}</div>
                            {deal.title_en && <div className="text-slate-400 text-xs mb-3 truncate">{deal.title_ja}</div>}
                            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                              <span>💴 Buy ¥{deal.buy_price_jpy.toLocaleString()}</span>
                              <span>📦 Ship ¥{(deal.shipping_estimate_jpy || 0).toLocaleString()}</span>
                              <span className="text-emerald-600 font-bold">💰 Sell ~${deal.ebay_sell_price_usd?.toFixed(0)}</span>
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-col gap-2 items-end">
                            <a href={deal.source_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-bold">
                              View on {deal.source} <ExternalLink size={12} />
                            </a>
                            <span className="text-slate-300 text-xs">
                              {new Date(deal.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Free plan paywall */}
                {plan === "free" && deals.length > 5 && (
                  <div className="mt-4 bg-gradient-to-b from-transparent via-white to-white relative -mt-8 pt-12 pb-6 text-center rounded-b-2xl border-x border-b border-slate-200">
                    <p className="font-black text-lg mb-2">+{deals.length - 5} more deals hidden</p>
                    <p className="text-slate-500 text-sm mb-4">Upgrade to Hunter to see all deals and get Slack/Discord alerts.</p>
                    <Link href="/pricing" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                      Unlock All Deals <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === "alerts" && (
          <div className="space-y-6">

            {/* Free plan CTA */}
            {plan === "free" && (
              <div className="bg-blue-600 rounded-2xl p-8 text-center text-white">
                <Bell size={32} className="mx-auto mb-4 text-blue-200" />
                <h3 className="font-black text-xl mb-2">Slack & Discord alerts require Hunter or Pro</h3>
                <p className="text-blue-100 text-sm mb-6">Get notified the instant a profitable deal appears — before anyone else sees it.</p>
                <Link href="/pricing" className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 font-black px-6 py-3 rounded-xl text-sm transition-colors">
                  Upgrade to Hunter — $29/month <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {/* Add alert form (hunter/pro only) */}
            {plan !== "free" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="font-black text-lg mb-5 flex items-center gap-2">
                  <Plus size={18} className="text-blue-600" /> Add Alert
                </h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Category</label>
                    <select value={newAlert.category ?? ""} onChange={e => setNewAlert(p => ({ ...p, category: e.target.value || null }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                      {CATEGORIES.map(c => <option key={c.value ?? ""} value={c.value ?? ""}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Minimum Profit (USD)</label>
                    <input type="number" min={5} max={500} value={newAlert.min_profit_usd}
                      onChange={e => setNewAlert(p => ({ ...p, min_profit_usd: parseInt(e.target.value) || 20 }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Slack Webhook URL</label>
                    <input type="url" value={newAlert.slack_webhook_url}
                      onChange={e => setNewAlert(p => ({ ...p, slack_webhook_url: e.target.value }))}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Discord Webhook URL</label>
                    <input type="url" value={newAlert.discord_webhook_url}
                      onChange={e => setNewAlert(p => ({ ...p, discord_webhook_url: e.target.value }))}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400" />
                  </div>
                </div>
                {alertError && <p className="text-red-500 text-sm mb-4">{alertError}</p>}
                <button onClick={saveAlert} disabled={savingAlert}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                  {savingAlert ? "Saving..." : "Save Alert"}
                </button>
              </div>
            )}

            {/* Existing alerts */}
            {alerts.length === 0 && plan !== "free" ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <Bell size={28} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-bold">No alerts yet</p>
                <p className="text-slate-400 text-sm mt-1">Add a webhook above to start getting notified.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert.id} className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${alert.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span className="font-bold text-sm">{CATEGORIES.find(c => c.value === alert.category)?.label || "All categories"}</span>
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          min ${alert.min_profit_usd} profit
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1.5 flex gap-4 flex-wrap">
                        {alert.slack_webhook_url && <span>📨 Slack connected</span>}
                        {alert.discord_webhook_url && <span>💬 Discord connected</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteAlert(alert.id)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
