"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Redirect to pricing after signup
      window.location.href = "/pricing?signup=1";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-black text-slate-900">
            JP<span className="text-blue-600">RADAR</span>
            <span className="ml-1.5 text-xs font-bold text-purple-600">StreamProof</span>
          </Link>
          <p className="text-slate-500 mt-2 text-sm">Create your account — then choose your plan</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
          )}
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 transition-colors" />
              <p className="text-slate-400 text-xs mt-1">Minimum 8 characters</p>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
              {loading ? "Creating account..." : "Create Account & Choose Plan →"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
            {["Start with 5 free game analyses", "No credit card required for Free plan", "Upgrade anytime"].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm mt-4">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}
