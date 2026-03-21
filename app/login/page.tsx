"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Activity, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleGoogle() {
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
    // on success the browser redirects — no need to do anything else
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">

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

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-base font-semibold text-white mb-1">Sign in</h2>
          <p className="text-xs text-zinc-500 mb-6">Use your OutX or Gmail account.</p>

          {error && (
            <div className="bg-rose-950/40 border border-rose-900/50 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-2.5 rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 text-sm font-semibold transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>

          <p className="text-[11px] text-zinc-700 mt-5 text-center">
            Access restricted to @outx.ai addresses
          </p>
        </div>
      </div>
    </div>
  );
}
