import Link from "next/link";
import { ArrowRight, BarChart3, Users, Zap, Shield, TrendingUp, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">FunnelMind</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium uppercase tracking-widest ml-1">Internal</span>
        </div>
        <Link
          href="/login"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Sign in <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          OutX.AI · Internal Growth Tool
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white max-w-3xl leading-tight">
          Growth &amp; Retention<br />
          <span className="text-indigo-400">Intelligence</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-xl leading-relaxed">
          Full-funnel analytics, churn prediction, and AI-powered insights — built specifically for OutX.AI.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-950/50"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
          {[
            { icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,  title: "Funnel Health",       desc: "Track every user from signup to paywall. See exactly where drop-offs happen." },
            { icon: <Users className="w-5 h-5 text-violet-400" />,      title: "User Behaviour",      desc: "Churn risk scoring, individual journey trees, and one-click re-engagement emails." },
            { icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,title: "Live Metrics",        desc: "DAU, WAU, D28 retention, and paid conversion — computed live from raw events." },
            { icon: <Zap className="w-5 h-5 text-amber-400" />,         title: "AI Email Drafts",     desc: "Claude writes personalised re-engagement emails based on each user's journey." },
            { icon: <Activity className="w-5 h-5 text-rose-400" />,     title: "Returning Users",     desc: "Feature adoption bars showing which returning users are actually using the product." },
            { icon: <Shield className="w-5 h-5 text-teal-400" />,       title: "OutX-only Access",    desc: "Restricted to @outx.ai emails. Built for the team, by the team." },
          ].map((f) => (
            <div key={f.title} className="text-left bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
              <div className="mb-3">{f.icon}</div>
              <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-8 py-5 border-t border-zinc-800/60 flex items-center justify-between">
        <span className="text-xs text-zinc-700">FunnelMind · OutX.AI internal tool</span>
        <span className="text-xs text-zinc-700">Access restricted to @outx.ai</span>
      </footer>
    </div>
  );
}
