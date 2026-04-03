"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    desc: "Explore the tool",
    features: [
      "5 game analyses/month",
      "Lv.1 lift analysis",
      "JP streamer rankings",
      "Genre filters",
    ],
    cta: "Start Free",
    highlight: false,
    stripePlan: null,
  },
  {
    id: "studio",
    name: "Studio",
    price: "$79",
    period: "/month",
    desc: "For indie studios",
    features: [
      "Unlimited game analyses",
      "Lv.1 + Lv.2 analysis",
      "Lag curve detection",
      "Budget optimizer",
      "Slack alerts",
      "Export reports",
    ],
    cta: "Start 7-day Trial",
    highlight: true,
    stripePlan: "hunter",
  },
  {
    id: "publisher",
    name: "Publisher",
    price: "$299",
    period: "/month",
    desc: "For publishers & agencies",
    features: [
      "Everything in Studio",
      "Lv.3 multi-factor analysis",
      "Confidence interval reports",
      "Multi-game tracking",
      "API access",
      "Priority support",
    ],
    cta: "Upgrade to Publisher",
    highlight: false,
    stripePlan: "pro",
  },
];

export default function PricingPage() {
  const [user, setUser] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
        if (data?.plan) setCurrentPlan(data.plan);
      }
    }
    load();
  }, []);

  async function handleUpgrade(planId: string) {
    if (!user) {
      window.location.href = `/auth/login?redirect=/pricing`;
      return;
    }
    if (!planId) return;
    setLoading(planId);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ plan: planId }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <nav className="flex justify-between items-center px-6 py-5 max-w-6xl mx-auto border-b border-slate-100">
        <Link href="/" className="font-black text-xl tracking-tight">
          JP<span className="text-blue-600">RADAR</span>
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/auth/login" className="text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">
              Login
            </Link>
          )}
        </div>
      </nav>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-14">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black tracking-tighter mb-4"
          >
            Simple, honest pricing
          </motion.h1>
          <p className="text-slate-500">Start free. Upgrade when you're making money.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const isCurrent = currentPlan === plan.id;
            const isLower = (
              (plan.id === "free" && currentPlan !== "free") ||
              (plan.id === "hunter" && currentPlan === "pro")
            );

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-6 border relative ${
                  plan.highlight
                    ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200"
                    : "bg-white border-slate-200"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full">
                    Current Plan
                  </div>
                )}
                {plan.highlight && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 text-xs font-black px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

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
                      <CheckCircle size={14} className={plan.highlight ? "text-blue-200 shrink-0" : "text-emerald-500 shrink-0"} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className={`block text-center font-bold py-3 rounded-xl text-sm ${plan.highlight ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                    ✓ Current Plan
                  </div>
                ) : isLower ? (
                  <div className={`block text-center font-bold py-3 rounded-xl text-sm text-slate-400 bg-slate-100`}>
                    Downgrade
                  </div>
                ) : (
                  <button
                    onClick={() => plan.stripePlan && handleUpgrade(plan.stripePlan)}
                    disabled={loading === plan.id || !plan.stripePlan}
                    className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 ${
                      plan.highlight
                        ? "bg-white text-blue-600 hover:bg-blue-50"
                        : "bg-slate-900 text-white hover:bg-slate-700"
                    }`}
                  >
                    {loading === plan.id ? "Redirecting..." : (
                      <>{plan.cta} <ArrowRight size={14} /></>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-slate-400 text-xs mt-8">
          All plans include a 7-day money-back guarantee. Cancel anytime.
        </p>
      </section>
    </div>
  );
}
