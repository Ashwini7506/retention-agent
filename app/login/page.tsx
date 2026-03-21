"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Activity, ArrowLeft, Mail, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  const ALLOWED_DOMAIN = "@outx.ai";
  const ALLOWED_EMAILS = ["ashessssm123@gmail.com"];

  function isAllowed(e: string) {
    return e.endsWith(ALLOWED_DOMAIN) || ALLOWED_EMAILS.includes(e);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    setError("");

    if (!isAllowed(trimmed)) {
      setError("Access is restricted to @outx.ai email addresses.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">

      {/* Back to landing */}
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-950/60">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">FunnelMind</h1>
          <p className="text-xs text-zinc-600 mt-1">OutX.AI · Internal Tool</p>
        </div>

        {sent ? (
          /* Success state */
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-base font-semibold text-white mb-2">Check your email</h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              We sent a magic link to<br />
              <span className="text-zinc-300 font-medium">{email}</span>
            </p>
            <p className="text-xs text-zinc-700 mt-4">Click the link in the email to sign in. No password needed.</p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-6 text-xs text-zinc-600 hover:text-zinc-400 underline underline-offset-2 transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Login form */
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h2 className="text-base font-semibold text-white mb-1">Sign in</h2>
            <p className="text-xs text-zinc-500 mb-6">
              Enter your OutX email — we&apos;ll send you a magic link.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium block mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@outx.ai"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-950/40 border border-rose-900/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-rose-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending link…</>
                ) : (
                  "Send magic link"
                )}
              </button>
            </form>

            <p className="text-[11px] text-zinc-700 mt-5 text-center">
              Access restricted to @outx.ai addresses
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
