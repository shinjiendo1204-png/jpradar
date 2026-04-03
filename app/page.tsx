"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { ArrowRight, CheckCircle, TrendingUp, BarChart2, Users, Zap, ChevronRight, Star } from "lucide-react";
import Link from "next/link";

const CASE_STUDIES = [
  {
    game: "Indie RPG (500 wishlists pre-launch)",
    streamer: "JP streamer A — 8,200 avg concurrent",
    result: "+340 Steam reviews in 48h",
    lift: "4.8×",
    type: "impulse",
    insight: "Impulse buyer driver — peak spike at hour 6",
  },
  {
    game: "Survival Game (global release)",
    streamer: "JP streamer B — 2,100 avg concurrent",
    result: "+89 incremental reviews",
    lift: "2.9×",
    type: "slow_burn",
    insight: "Wishlist builder — converted heavily on week 1 sale",
  },
  {
    game: "Card Game (JP localization)",
    streamer: "JP streamer C — 4,700 avg concurrent",
    result: "+201 incremental reviews",
    lift: "6.1×",
    type: "same_day",
    insight: "Perfect genre fit — card game audience converted same day",
  },
];

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await supabase.from("jpradar_waitlist").insert({ email, created_at: new Date().toISOString() });
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
          <span className="ml-2 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">StreamProof</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/clarity" className="text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">Try Free</Link>
          <Link href="/auth/login" className="text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">Login</Link>
          <a href="#signup" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            Get Access
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-8">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
          The problem with streamer marketing
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl font-black tracking-tighter mb-6 leading-[1.05]">
          1M followers.<br />
          <span className="text-red-500">Zero sales.</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-xl text-slate-500 mb-6 max-w-2xl mx-auto leading-relaxed">
          You paid a JP streamer with 50,000 concurrent viewers to play your game.
          Downloads barely moved. Sound familiar?
        </motion.p>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="text-lg text-slate-700 font-bold mb-10 max-w-xl mx-auto">
          The problem: <span className="text-blue-600">you measured reach, not results.</span>
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-5 mb-10 text-sm text-slate-500">
          {["Incrementality analysis — not vanity metrics", "Steam review correlation", "Wishlist vs. impulse buyer detection"].map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              {t}
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-wrap justify-center gap-4">
          <Link href="/clarity"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg px-8 py-4 rounded-xl transition-colors shadow-lg shadow-blue-200">
            Analyze a JP Streamer Free <ArrowRight size={20} />
          </Link>
          <a href="#how"
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold text-base px-6 py-4 rounded-xl hover:border-slate-400 transition-colors">
            See how it works
          </a>
        </motion.div>
        <p className="text-slate-400 text-xs mt-3">No signup required to try. Steam-based data.</p>
      </section>

      {/* PROBLEM SECTION */}
      <section className="bg-slate-950 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white mb-4">The $50,000/hour illusion</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Top global streamers command $50k/hour (WSJ, 2019). JP top-tier streamers: ~¥2M per campaign.
              Yet most developers can't answer: <strong className="text-white">"Did it actually work?"</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { bad: "50,000 concurrent viewers", reality: "≠ 50,000 potential buyers", icon: "👥" },
              { bad: "2M Twitch followers", reality: "≠ game purchasing audience", icon: "📊" },
              { bad: "+300% watchtime spike", reality: "≠ incremental sales lift", icon: "📈" },
            ].map((s, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                <div className="text-3xl mb-3">{s.icon}</div>
                <div className="text-white font-bold mb-1">{s.bad}</div>
                <div className="text-red-400 text-sm font-bold">{s.reality}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 bg-blue-900/40 border border-blue-700 rounded-2xl p-6 text-center">
            <p className="text-blue-200 text-lg font-bold">
              JP StreamProof measures the <span className="text-white">incremental reviews that would NOT have happened</span> without each streamer —
              with statistical confidence intervals.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black mb-3">How JP StreamProof works</h2>
          <p className="text-slate-500 text-sm">Three levels of evidence — from simple to scientific</p>
        </div>

        <div className="space-y-6">
          {[
            {
              level: "Lv.1",
              title: "Pre-Post Lift",
              desc: "Compare Steam review velocity before and after each broadcast. Immediate answer: did this stream move the needle?",
              example: '"Reviews increased 4.2× in the 48h after this stream vs. prior 7-day baseline."',
              color: "bg-blue-50 border-blue-200",
            },
            {
              level: "Lv.2",
              title: "Baseline-Adjusted Incrementality",
              desc: "Remove natural growth trends, weekend effects, and sale periods. What's left is the pure streamer contribution.",
              example: '"Even after removing the Steam summer sale effect, this streamer drove +89 incremental reviews (95% CI: 72–108)."',
              color: "bg-emerald-50 border-emerald-200",
            },
            {
              level: "Lv.3",
              title: "Lag Curve Analysis",
              desc: "Identify whether a streamer drives impulse buyers (hours) or wishlist-to-sale converters (weeks). Choose the right one for your campaign timing.",
              example: '"This streamer is a slow-burn converter. Use them 1 week before your sale — not on launch day."',
              color: "bg-purple-50 border-purple-200",
            },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border p-6 ${s.color}`}>
              <div className="flex items-start gap-4">
                <span className="text-xs font-black text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-lg shrink-0">{s.level}</span>
                <div>
                  <h3 className="font-black text-lg mb-2">{s.title}</h3>
                  <p className="text-slate-600 text-sm mb-3">{s.desc}</p>
                  <div className="bg-white rounded-lg px-4 py-2 text-sm text-slate-500 italic border border-slate-100">
                    {s.example}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CASE STUDIES */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3">What the data looks like</h2>
            <p className="text-slate-500 text-sm">Illustrative examples based on real patterns from Steam + Twitch data</p>
          </div>
          <div className="space-y-4">
            {CASE_STUDIES.map((c, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="shrink-0 text-center md:w-24">
                  <div className="text-3xl font-black text-emerald-600">{c.lift}</div>
                  <div className="text-slate-400 text-xs">lift ratio</div>
                </div>
                <div className="hidden md:block w-px bg-slate-100 self-stretch" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm mb-0.5">{c.game}</div>
                  <div className="text-slate-500 text-xs mb-2">{c.streamer}</div>
                  <div className="text-emerald-600 font-bold text-sm">{c.result}</div>
                </div>
                <div className="shrink-0">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${
                    c.type === 'impulse' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    c.type === 'slow_burn' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {c.insight}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 max-w-5xl mx-auto px-6" id="pricing">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black mb-3">Simple pricing</h2>
          <p className="text-slate-500 text-sm">Start free. Upgrade when the data proves its value.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: "Free",
              price: "$0",
              period: "",
              desc: "Explore the tool",
              features: ["5 game analyses/month", "Lv.1 lift analysis", "JP streamer rankings", "Genre filters"],
              cta: "Start Free",
              href: "/clarity",
              highlight: false,
              stripePlan: null,
            },
            {
              name: "Studio",
              price: "$79",
              period: "/month",
              desc: "For indie studios",
              features: ["Unlimited game analyses", "Lv.1 + Lv.2 analysis", "Lag curve (impulse vs. slow burn)", "Budget optimizer", "Slack alerts", "Export reports"],
              cta: "Start 7-day Trial",
              href: "/auth/signup",
              highlight: true,
              stripePlan: "studio",
            },
            {
              name: "Publisher",
              price: "$299",
              period: "/month",
              desc: "For publishers & agencies",
              features: ["Everything in Studio", "Lv.3 multi-factor analysis", "Confidence interval reports", "Multi-game tracking", "API access", "Priority support"],
              cta: "Contact Us",
              href: "mailto:hello@wakaruai.net",
              highlight: false,
              stripePlan: "publisher",
            },
          ].map((plan, i) => (
            <div key={i} className={`rounded-2xl p-6 border relative ${plan.highlight ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200" : "bg-white border-slate-200"}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 text-xs font-black px-3 py-1 rounded-full">Most Popular</div>
              )}
              <div className={`text-xs font-black uppercase tracking-widest mb-1 ${plan.highlight ? "text-blue-200" : "text-slate-400"}`}>{plan.name}</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className={`text-sm mb-1 ${plan.highlight ? "text-blue-200" : "text-slate-400"}`}>{plan.period}</span>
              </div>
              <div className={`text-sm mb-6 ${plan.highlight ? "text-blue-100" : "text-slate-500"}`}>{plan.desc}</div>
              <ul className="space-y-2 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <CheckCircle size={14} className={`mt-0.5 shrink-0 ${plan.highlight ? "text-blue-200" : "text-emerald-500"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={plan.href}
                className={`block text-center font-bold py-3 rounded-xl transition-colors text-sm ${
                  plan.highlight ? "bg-white text-blue-600 hover:bg-blue-50" : "bg-slate-900 text-white hover:bg-slate-700"
                }`}>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-400 text-xs mt-6">Studio plan: 7-day free trial. Cancel anytime. Publisher plan: annual billing available.</p>
      </section>

      {/* SIGNUP */}
      <section id="signup" className="bg-slate-950 py-24">
        <div className="max-w-xl mx-auto px-6 text-center">
          <Zap size={32} className="text-blue-400 mx-auto mb-6" />
          <h2 className="text-4xl font-black text-white mb-4">Stop guessing. Start proving.</h2>
          <p className="text-slate-400 text-sm mb-10">
            Join game studios already using JP StreamProof to find streamers that actually move their numbers.
          </p>
          {submitted ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-emerald-900/30 border border-emerald-700 rounded-2xl p-8">
              <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
              <div className="text-white font-black text-xl mb-2">You're on the list.</div>
              <div className="text-emerald-300 text-sm">We'll be in touch shortly.</div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@studio.com" required
                className="flex-1 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-sm" />
              <button type="submit" disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3 rounded-xl text-sm flex items-center gap-2 justify-center whitespace-nowrap">
                {loading ? "..." : <><ChevronRight size={16} /> Get Early Access</>}
              </button>
            </form>
          )}
          <div className="mt-8">
            <Link href="/clarity"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
              Or try it now — no signup needed <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="font-black text-slate-900">
            JP<span className="text-blue-600">RADAR</span>
            <span className="ml-2 text-xs text-slate-400 font-normal">StreamProof</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/clarity" className="hover:text-slate-600">Try Free</Link>
            <Link href="/pricing" className="hover:text-slate-600">Pricing</Link>
            <Link href="/legal/privacy" className="hover:text-slate-600">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-slate-600">Terms</Link>
            <Link href="/auth/login" className="hover:text-slate-600">Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
