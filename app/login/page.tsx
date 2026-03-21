"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Wrong password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-950/60">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">FunnelMind</h1>
          <p className="text-xs text-zinc-600 mt-1">OutX.AI · Internal Tool</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter team password"
                required
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
