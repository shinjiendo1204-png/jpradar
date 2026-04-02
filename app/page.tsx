"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { ArrowRight, CheckCircle, Radio, TrendingUp, Bell, FileText, Zap, Shield, Globe } from "lucide-react";
import Link from "next/link";

const SAMPLE_REPORT = {
  date: "April 2, 2026",
  keyword: "AI SaaS",
  summary: "Significant positive buzz around AI productivity tools this week. 3 viral threads on X JP discussing enterprise AI adoption. One emerging competitor gaining traction with freemium model.",
  trends: [
    { label: "Sentiment", value: "78% Positive", up: true },
    { label: "Volume", value: "+34% vs last week", up: true },
    { label: "Top Platform", value: "X (Twitter JP)", up: true },
  ],
  topPosts: [
    { platform: "X JP", content: "\"AI tools for business are finally getting good at Japanese context. Using [keyword] daily now. Game changer for our team.\" — @techfounder_jp (12K followers, 847 likes)", sentiment: "positive" },
    { platform: "Note", content: "Long-form article: '2026年のSaaS市場を変えるAIツール10選' — 4.2K reads, featured by Note editors", sentiment: "positive" },
  ],
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
    <div className="min-h-screen bg-white text-slate-900">

      {/* NAV */}
      <nav className="flex justify-between items-center px-6 py-5 max-w-6xl mx-auto border-b border-slate-100">
        <div className="font-black text-xl tracking-tight text-slate-900">
          JP<span className="text-blue-600">RADAR</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">Login</Link>
          <a href="#signup" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            Join Beta
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-8"
        >
          <Radio size={12} className="animate-pulse" />
          Japan Social Intelligence Platform
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight text-slate-900"
        >
          See what Japan is<br />
          <span className="text-blue-600">saying about you.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Japanese Twitter, Note, and online communities — monitored 24/7.
          Delivered to your Slack in English. Every morning.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-6 mb-10"
        >
          {["No Japanese required", "Daily English reports", "Slack integration"].map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-500 text-sm">
              <CheckCircle size={16} className="text-green-500" />
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
          Join the Beta — Free <ArrowRight size={20} />
        </motion.a>
        <p className="text-slate-400 text-xs mt-3">First 20 companies get 3 months free.</p>
      </section>

      {/* SAMPLE REPORT */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-2 text-slate-900">This lands in your Slack every morning.</h2>
            <p className="text-slate-500 text-sm">Real format. Sample data.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-black text-white">JP</div>
                <div>
                  <div className="font-bold text-sm text-slate-900">JPRADAR Daily Report</div>
                  <div className="text-slate-400 text-xs">{SAMPLE_REPORT.date} · Keyword: "{SAMPLE_REPORT.keyword}"</div>
                </div>
              </div>
              <div className="text-green-600 text-xs font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>LIVE
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Executive Summary</div>
                <p className="text-slate-700 text-sm leading-relaxed">{SAMPLE_REPORT.summary}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {SAMPLE_REPORT.trends.map((t, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs text-slate-400 mb-1">{t.label}</div>
                    <div className="font-black text-sm text-green-600">{t.value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Top Posts This Week</div>
                <div className="space-y-3">
                  {SAMPLE_REPORT.topPosts.map((p, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-bold">{p.platform}</span>
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">Positive</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed">{p.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Zap size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-amber-600 mb-1">Recommended Action</div>
                    <p className="text-slate-700 text-xs">{SAMPLE_REPORT.action}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black text-center mb-12 text-slate-900">How JPRADAR works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <TrendingUp size={24} className="text-blue-600" />, step: "01", title: "Set your keywords", desc: "Enter your brand, competitors, or market topics. In English." },
            { icon: <Radio size={24} className="text-blue-600" />, step: "02", title: "We monitor Japan 24/7", desc: "X JP, Note, Reddit JP, and more — scanned daily in Japanese." },
            { icon: <Bell size={24} className="text-blue-600" />, step: "03", title: "Get English intel", desc: "Daily report in Slack. Sentiment, top posts, competitor moves, actions." },
          ].map((s, i) => (
            <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:border-blue-200 transition-colors">
              <div className="mb-4">{s.icon}</div>
              <div className="text-xs font-black text-slate-300 mb-2">{s.step}</div>
              <h3 className="font-black mb-2 text-slate-900">{s.title}</h3>
              <p className="text-slate-500 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { icon: <Globe size={24} className="text-blue-600 mx-auto mb-3" />, title: "Japanese-native monitoring", desc: "We read slang, context, and nuance — not just keywords." },
              { icon: <Shield size={24} className="text-blue-600 mx-auto mb-3" />, title: "Privacy first", desc: "Your keywords are private. We never share client data." },
              { icon: <Zap size={24} className="text-blue-600 mx-auto mb-3" />, title: "Actionable, not just data", desc: "Every report includes a recommended action. Not just raw data." },
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200">
                {t.icon}
                <h3 className="font-black mb-2 text-slate-900">{t.title}</h3>
                <p className="text-slate-500 text-sm">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black text-center mb-3 text-slate-900">Simple pricing</h2>
        <p className="text-slate-500 text-center mb-12">Less than one hour with a Japan market consultant.</p>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { name: "Starter", price: "$299", period: "/month", desc: "For teams exploring Japan", features: ["3 keywords monitored", "Weekly digest report", "Slack notification", "X JP + Note coverage", "Email support"], highlight: false },
            { name: "Pro", price: "$799", period: "/month", desc: "For active Japan market players", features: ["10 keywords monitored", "Daily reports", "Real-time Slack alerts", "X JP + Note + 5ch", "Competitor tracking", "Priority support"], highlight: true },
          ].map((p, i) => (
            <div key={i} className={`rounded-2xl p-8 border-2 ${p.highlight ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}>
              {p.highlight && <div className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3">Most Popular</div>}
              <h3 className="text-xl font-black mb-1 text-slate-900">{p.name}</h3>
              <p className="text-slate-500 text-sm mb-4">{p.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900">{p.price}</span>
                <span className="text-slate-500 text-sm">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-8">
                {p.features.map((f, fi) => (
                  <li key={fi} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <a href="#signup" className={`block text-center font-black py-3 rounded-xl transition-colors ${p.highlight ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200" : "bg-slate-900 hover:bg-slate-800 text-white"}`}>
                Start Free Beta
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* SIGNUP */}
      <section id="signup" className="bg-slate-50 py-20">
        <div className="max-w-xl mx-auto px-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <FileText size={32} className="text-blue-600 mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-3 text-slate-900">Join the Beta</h2>
            <p className="text-slate-500 mb-8">First 20 companies get 3 months free.</p>

            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-black mb-2 text-slate-900">You're on the list!</h3>
                <p className="text-slate-500 text-sm">We'll reach out within 24 hours to set up your keyword tracking.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="email" placeholder="your@company.com" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors" />
                <input type="text" placeholder="Keyword to monitor (e.g. 'your brand', 'AI SaaS')" value={keyword} onChange={e => setKeyword(e.target.value)} required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors" />
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-blue-200">
                  {loading ? "Submitting..." : <>Join Beta — Free <ArrowRight size={20} /></>}
                </button>
                <p className="text-slate-400 text-xs">No credit card required.</p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 py-8 px-6 text-center text-slate-400 text-sm">
        <p>© 2026 JPRADAR by <a href="https://wakaruai.net" className="hover:text-slate-600 transition-colors">WAKARUAI</a></p>
      </footer>
    </div>
  );
}
