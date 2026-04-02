"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { ArrowRight, CheckCircle, Radio, TrendingUp, Bell, FileText, Zap } from "lucide-react";

const SAMPLE_REPORT = {
  date: "April 2, 2026",
  keyword: "AI SaaS",
  summary: "Significant positive buzz around AI productivity tools this week. 3 viral threads on X JP discussing enterprise AI adoption. One emerging competitor (StudioAI JP) gaining traction with freemium model.",
  trends: [
    { label: "Sentiment", value: "78% Positive", up: true },
    { label: "Volume", value: "+34% vs last week", up: true },
    { label: "Top Platform", value: "X (Twitter JP)", up: true },
  ],
  topPosts: [
    { platform: "X JP", content: "\"AI tools for business are finally getting good at Japanese context. Using [keyword] daily now. Game changer for our team.\" — @techfounder_jp (12K followers, 847 likes)", sentiment: "positive" },
    { platform: "Note", content: "Long-form article: '2026年のSaaS市場を変えるAIツール10選' (10 AI tools changing SaaS in 2026) — 4.2K reads, featured by Note editors", sentiment: "positive" },
    { platform: "X JP", content: "\"Tried [competitor] and [keyword] — still prefer the UI of [keyword]. Support is also way faster.\" — @startup_cto (3.2K followers)", sentiment: "positive" },
  ],
  competitors: ["StudioAI JP gaining freemium users", "TechBase launching JP-specific features Q2"],
  action: "Consider creating JP-specific content around 'enterprise AI adoption' — high search intent this week.",
};

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [keyword, setKeyword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !keyword) return;
    setLoading(true);
    try {
      await supabase.from("jpradar_waitlist").insert({ email, keyword, created_at: new Date().toISOString() });
    } catch {}
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#080810] text-white">

      {/* NAV */}
      <nav className="flex justify-between items-center px-6 py-5 max-w-6xl mx-auto">
        <div className="font-black text-lg tracking-tight">
          JP<span className="text-red-500">RADAR</span>
        </div>
        <a href="#signup" className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
          Join Beta
        </a>
      </nav>

      {/* HERO */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-red-950/50 border border-red-900/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-8"
        >
          <Radio size={12} className="animate-pulse" />
          Live Japan Intelligence
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight"
        >
          See what Japan is<br />
          <span className="text-red-500">saying about you.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          Japanese Twitter, Note, and online communities — monitored 24/7.
          Delivered to your Slack in English. Every morning.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
        >
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <CheckCircle size={16} className="text-green-500" />
            No Japanese required
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <CheckCircle size={16} className="text-green-500" />
            Daily English reports
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <CheckCircle size={16} className="text-green-500" />
            Slack integration
          </div>
        </motion.div>

        <motion.a
          href="#signup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black text-lg px-8 py-4 rounded-xl transition-colors shadow-lg shadow-red-600/20"
        >
          Join the Beta — Free <ArrowRight size={20} />
        </motion.a>
        <p className="text-slate-600 text-xs mt-3">First 20 companies get 3 months free.</p>
      </section>

      {/* SAMPLE REPORT */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black mb-2">This is what lands in your Slack every morning.</h2>
          <p className="text-slate-500 text-sm">Real format. Sample data.</p>
        </div>

        <div className="bg-[#0f0f1a] border border-slate-800 rounded-2xl overflow-hidden">
          {/* Report header */}
          <div className="bg-[#13131f] border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-xs font-black">JP</div>
              <div>
                <div className="font-bold text-sm">JPRADAR Daily Report</div>
                <div className="text-slate-500 text-xs">{SAMPLE_REPORT.date} · Keyword: "{SAMPLE_REPORT.keyword}"</div>
              </div>
            </div>
            <div className="text-green-400 text-xs font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              LIVE
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Summary */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Executive Summary</div>
              <p className="text-slate-300 text-sm leading-relaxed">{SAMPLE_REPORT.summary}</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4">
              {SAMPLE_REPORT.trends.map((t, i) => (
                <div key={i} className="bg-[#080810] rounded-xl p-4 border border-slate-800">
                  <div className="text-xs text-slate-500 mb-1">{t.label}</div>
                  <div className="font-black text-sm text-green-400">{t.value}</div>
                </div>
              ))}
            </div>

            {/* Top posts */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Top Posts This Week</div>
              <div className="space-y-3">
                {SAMPLE_REPORT.topPosts.map((p, i) => (
                  <div key={i} className="bg-[#080810] rounded-xl p-4 border border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded font-bold">{p.platform}</span>
                      <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded font-bold">Positive</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">{p.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action */}
            <div className="bg-yellow-950/30 border border-yellow-900/40 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Zap size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-yellow-400 mb-1">Recommended Action</div>
                  <p className="text-slate-300 text-xs">{SAMPLE_REPORT.action}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-black text-center mb-12">How JPRADAR works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <TrendingUp size={24} />, step: "01", title: "You set your keywords", desc: "Enter your brand, competitors, or market topics. In English." },
            { icon: <Radio size={24} />, step: "02", title: "We monitor Japan 24/7", desc: "X JP, Note, Reddit JP, and more — scanned every day. Japanese language, human-like browsing." },
            { icon: <Bell size={24} />, step: "03", title: "You get English intel", desc: "Daily report in your Slack. Sentiment, top posts, competitor moves, recommended actions." },
          ].map((s, i) => (
            <div key={i} className="bg-[#0f0f1a] border border-slate-800 rounded-2xl p-6">
              <div className="text-red-500 mb-4">{s.icon}</div>
              <div className="text-xs font-black text-slate-600 mb-2">{s.step}</div>
              <h3 className="font-black mb-2">{s.title}</h3>
              <p className="text-slate-500 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-black text-center mb-4">Simple pricing</h2>
        <p className="text-slate-500 text-center mb-12">Less than one hour with a Japan market consultant.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              name: "Starter",
              price: "$299",
              period: "/month",
              desc: "For teams exploring Japan",
              features: ["3 keywords monitored", "Weekly digest report", "Slack notification", "X JP + Note coverage", "Email support"],
              cta: "Start Free Beta",
              highlight: false,
            },
            {
              name: "Pro",
              price: "$799",
              period: "/month",
              desc: "For active Japan market players",
              features: ["10 keywords monitored", "Daily reports", "Real-time Slack alerts", "X JP + Note + 5ch coverage", "Competitor tracking", "Custom keyword requests", "Priority support"],
              cta: "Start Free Beta",
              highlight: true,
            },
          ].map((p, i) => (
            <div key={i} className={`rounded-2xl p-8 border-2 ${p.highlight ? "border-red-500 bg-[#0f0f1a]" : "border-slate-800 bg-[#0f0f1a]"}`}>
              {p.highlight && <div className="text-xs font-black text-red-400 uppercase tracking-widest mb-3">Most Popular</div>}
              <h3 className="text-xl font-black mb-1">{p.name}</h3>
              <p className="text-slate-500 text-sm mb-4">{p.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-black">{p.price}</span>
                <span className="text-slate-500 text-sm">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-8">
                {p.features.map((f, fi) => (
                  <li key={fi} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#signup" className={`block text-center font-black py-3 rounded-xl transition-colors ${p.highlight ? "bg-red-600 hover:bg-red-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"}`}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* SIGNUP */}
      <section id="signup" className="max-w-2xl mx-auto px-6 pb-32">
        <div className="bg-[#0f0f1a] border border-slate-800 rounded-2xl p-10 text-center">
          <FileText size={32} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-3">Join the Beta</h2>
          <p className="text-slate-400 mb-8">First 20 companies get 3 months free. Tell us your keyword and we'll set you up.</p>

          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-black mb-2">You're on the list!</h3>
              <p className="text-slate-400 text-sm">We'll reach out within 24 hours to set up your first keyword tracking.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="your@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#080810] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
              <input
                type="text"
                placeholder="Keyword to monitor (e.g. 'AI SaaS', 'your brand name')"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                required
                className="w-full bg-[#080810] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
              >
                {loading ? "Submitting..." : <>Join Beta — Free <ArrowRight size={20} /></>}
              </button>
              <p className="text-slate-600 text-xs">No credit card required. We'll reach out within 24 hours.</p>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-8 px-6 text-center text-slate-600 text-sm">
        <p>© 2026 JPRADAR by WAKARUAI · <a href="https://wakaruai.net" className="hover:text-slate-400 transition-colors">wakaruai.net</a></p>
      </footer>

    </div>
  );
}
