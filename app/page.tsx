"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  ArrowRight, CheckCircle, Zap, Bell, TrendingUp,
  DollarSign, Package, Search, ChevronRight
} from "lucide-react";
import Link from "next/link";

// Sample deal card for the LP demo
const SAMPLE_DEALS = [
  {
    title_en: "Super Famicom Final Fantasy VI",
    title_ja: "スーパーファミコン ファイナルファンタジーVI",
    buy_jpy: 1980,
    ship_jpy: 2800,
    sell_usd: 89,
    profit_usd: 62,
    margin: 74,
    tier: "excellent",
    source: "Surugaya",
    platform: "eBay",
  },
  {
    title_en: "Pokemon Card Game Booster Box (JP)",
    title_ja: "ポケモンカードゲーム ブースターボックス",
    buy_jpy: 4500,
    ship_jpy: 3200,
    sell_usd: 145,
    profit_usd: 88,
    margin: 63,
    tier: "excellent",
    source: "Surugaya",
    platform: "Whatnot",
  },
  {
    title_en: "Neon Genesis Evangelion Figure Limited",
    title_ja: "新世紀エヴァンゲリオン フィギュア 限定版",
    buy_jpy: 3200,
    ship_jpy: 3600,
    sell_usd: 78,
    profit_usd: 34,
    margin: 46,
    tier: "high",
    source: "Surugaya",
    platform: "eBay",
  },
];

const TIER_COLOR: Record<string, string> = {
  excellent: "text-red-500",
  high: "text-emerald-600",
  medium: "text-yellow-500",
};

const TIER_BG: Record<string, string> = {
  excellent: "bg-red-50 border-red-200",
  high: "bg-emerald-50 border-emerald-200",
  medium: "bg-yellow-50 border-yellow-200",
};

const TIER_LABEL: Record<string, string> = {
  excellent: "🔥 Hot Deal",
  high: "💚 Good Deal",
  medium: "🟡 Fair Deal",
};

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await supabase
        .from("jpradar_waitlist")
        .insert({ email, created_at: new Date().toISOString() });
    } catch {}
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* NAV */}
      <nav className="flex justify-between items-center px-6 py-5 max-w-6xl mx-auto border-b border-slate-100">
        <div className="font-black text-xl tracking-tight">
          JP<span className="text-blue-600">RADAR</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">
            Login
          </Link>
          <a
            href="#signup"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Get Early Access
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
          Japan Arbitrage Scanner — Live
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[1.05]"
        >
          Japan's thrift stores<br />
          <span className="text-blue-600">are printing money.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-slate-500 mb-8 max-w-2xl mx-auto leading-relaxed"
        >
          jpradar scans Surugaya, Yahoo Auctions and Hard Off 24/7,
          compares prices on eBay and Whatnot, and alerts you the moment
          a profitable deal appears — in English, with profit included.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-5 mb-10 text-sm text-slate-500"
        >
          {[
            "No Japanese required",
            "Profit calculated automatically",
            "Shipping cost included",
            "Slack & Discord alerts",
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              {t}
            </div>
          ))}
        </motion.div>

        <motion.a
          href="#signup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg px-8 py-4 rounded-xl transition-colors shadow-lg shadow-blue-200"
        >
          Get Early Access — Free <ArrowRight size={20} />
        </motion.a>
        <p className="text-slate-400 text-xs mt-3">No credit card. Cancel anytime.</p>
      </section>

      {/* LIVE DEAL FEED DEMO */}
      <section className="bg-slate-950 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Live Deal Feed — Sample
            </div>
            <h2 className="text-3xl font-black text-white mb-3">
              This lands in your Slack right now.
            </h2>
            <p className="text-slate-400 text-sm">Real format. Sample data. Your deals will look exactly like this.</p>
          </div>

          <div className="space-y-4">
            {SAMPLE_DEALS.map((deal, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4"
              >
                {/* Profit badge */}
                <div className="shrink-0 text-center">
                  <div className={`text-3xl font-black ${TIER_COLOR[deal.tier] || "text-white"}`}>
                    +${deal.profit_usd}
                  </div>
                  <div className="text-slate-500 text-xs mt-1">{deal.margin}% margin</div>
                  <div className={`text-xs font-bold mt-2 px-2 py-1 rounded-full border ${TIER_BG[deal.tier]}`}>
                    {TIER_LABEL[deal.tier]}
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-800 self-stretch" />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm mb-1 truncate">{deal.title_en}</div>
                  <div className="text-slate-500 text-xs mb-3 truncate">{deal.title_ja}</div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-slate-400">
                      💴 Buy <span className="text-white font-bold">¥{deal.buy_jpy.toLocaleString()}</span>
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="text-slate-400">
                      📦 Ship <span className="text-white font-bold">¥{deal.ship_jpy.toLocaleString()}</span>
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="text-slate-400">
                      💰 Sell on {deal.platform} <span className="text-emerald-400 font-bold">${deal.sell_usd}</span>
                    </span>
                  </div>
                </div>

                {/* Source */}
                <div className="shrink-0 text-right">
                  <div className="text-slate-600 text-xs">Found on</div>
                  <div className="text-blue-400 text-xs font-bold">{deal.source}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            jpradar scans every 2 hours. You get notified the moment profit exceeds your threshold.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black mb-3">How it works</h2>
          <p className="text-slate-500 text-sm">Set it once. Deals come to you.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            {
              icon: <Search size={22} className="text-blue-600" />,
              step: "01",
              title: "Scan",
              desc: "jpradar monitors Surugaya, Yahoo Auctions, and Hard Off every 2 hours for new listings.",
            },
            {
              icon: <TrendingUp size={22} className="text-blue-600" />,
              step: "02",
              title: "Price Check",
              desc: "Each item is compared against eBay sold listings and Whatnot to find the real overseas price.",
            },
            {
              icon: <DollarSign size={22} className="text-blue-600" />,
              step: "03",
              title: "Calculate",
              desc: "Profit is calculated after shipping (tenso estimates), eBay fees (13%), and live exchange rate.",
            },
            {
              icon: <Bell size={22} className="text-blue-600" />,
              step: "04",
              title: "Alert",
              desc: "If profit exceeds your threshold, you get an instant Slack or Discord notification in English.",
            },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {s.icon}
              </div>
              <div className="text-blue-600 text-xs font-black tracking-widest mb-2">{s.step}</div>
              <div className="font-black text-lg mb-2">{s.title}</div>
              <div className="text-slate-500 text-sm leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY JAPAN */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3">Why Japan?</h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">
              The yen is weak, stores are packed with inventory, and most foreign buyers don't speak Japanese.
              That gap is your opportunity.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                stat: "2–5×",
                label: "Average price premium on eBay vs. Japan",
                note: "Retro games, figures, Pokemon cards",
              },
              {
                stat: "¥149",
                label: "USD/JPY rate — weakest yen in 30 years",
                note: "Makes Japanese goods even cheaper in USD",
              },
              {
                stat: "0",
                label: "Japanese language needed",
                note: "jpradar translates everything automatically",
              },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                <div className="text-4xl font-black text-blue-600 mb-2">{s.stat}</div>
                <div className="font-bold text-sm mb-1">{s.label}</div>
                <div className="text-slate-400 text-xs">{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black mb-3">Simple pricing</h2>
          <p className="text-slate-500 text-sm">Start free. Upgrade when you're making money.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: "Free",
              price: "$0",
              period: "/month",
              desc: "Test the waters",
              features: ["5 deal alerts/day", "Email notifications", "All categories", "7-day deal history"],
              cta: "Start Free",
              highlight: false,
            },
            {
              name: "Hunter",
              price: "$29",
              period: "/month",
              desc: "For active flippers",
              features: ["Unlimited alerts", "Slack & Discord", "Category filters", "Min profit threshold", "30-day history"],
              cta: "Start Hunting",
              highlight: true,
            },
            {
              name: "Pro",
              price: "$79",
              period: "/month",
              desc: "For serious resellers",
              features: ["Everything in Hunter", "Priority alerts (15 min)", "Multiple webhooks", "Profit analytics", "CSV export"],
              cta: "Go Pro",
              highlight: false,
            },
          ].map((plan, i) => (
            <div
              key={i}
              className={`rounded-2xl p-6 border ${
                plan.highlight
                  ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className={`text-xs font-black uppercase tracking-widest mb-1 ${plan.highlight ? "text-blue-200" : "text-slate-400"}`}>
                {plan.name}
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className={`text-sm mb-1 ${plan.highlight ? "text-blue-200" : "text-slate-400"}`}>{plan.period}</span>
              </div>
              <div className={`text-sm mb-6 ${plan.highlight ? "text-blue-100" : "text-slate-500"}`}>{plan.desc}</div>
              <ul className="space-y-2 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={14} className={plan.highlight ? "text-blue-200" : "text-emerald-500"} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#signup"
                className={`block text-center font-bold py-3 rounded-xl transition-colors text-sm ${
                  plan.highlight
                    ? "bg-white text-blue-600 hover:bg-blue-50"
                    : "bg-slate-900 text-white hover:bg-slate-700"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* SIGNUP */}
      <section id="signup" className="bg-slate-950 py-24">
        <div className="max-w-xl mx-auto px-6 text-center">
          <Zap size={32} className="text-blue-400 mx-auto mb-6" />
          <h2 className="text-4xl font-black text-white mb-4">
            Start finding deals today.
          </h2>
          <p className="text-slate-400 text-sm mb-10">
            Join the waitlist. First 50 users get 3 months of Hunter free.
          </p>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-900/30 border border-emerald-700 rounded-2xl p-8"
            >
              <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
              <div className="text-white font-black text-xl mb-2">You're on the list.</div>
              <div className="text-emerald-300 text-sm">We'll email you when your account is ready.</div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black px-6 py-3 rounded-xl transition-colors text-sm flex items-center gap-2 whitespace-nowrap justify-center"
              >
                {loading ? "Joining..." : "Get Early Access"} <ChevronRight size={16} />
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="font-black text-slate-900">
            JP<span className="text-blue-600">RADAR</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/legal/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            <Link href="/auth/login" className="hover:text-slate-600 transition-colors">Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
