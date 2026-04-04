import Link from "next/link";
import { ArrowRight, BarChart3, Users, Zap, TrendingUp, Activity, Clock, Layers, CreditCard } from "lucide-react";

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
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-6 py-20">
        <div className="text-center max-w-3xl w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            OutX.AI · Internal Growth Tool
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white max-w-3xl leading-tight">
            Growth &amp; Retention<br />
            <span className="text-indigo-400">Intelligence</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Full-funnel analytics, churn prediction, and AI-powered insights — built specifically for OutX.AI.
          </p>

          <div className="mt-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-950/50"
            >
              Open Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Loom Demo */}
          <div className="mt-14 w-full rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl shadow-indigo-950/30" style={{ position: "relative", paddingBottom: "62.5%", height: 0 }}>
            <iframe
              src="https://www.loom.com/embed/c2c11adca2c74eba877fa96101109b62"
              frameBorder="0"
              allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
          </div>

          {/* Feature grid */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {[
              { icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,   title: "Funnel Health",    desc: "Track every user from signup to paywall. See exactly where drop-offs happen." },
              { icon: <Users className="w-5 h-5 text-violet-400" />,       title: "User Behaviour",   desc: "Churn risk scoring, individual journey trees, and one-click re-engagement emails." },
              { icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, title: "Live Metrics",     desc: "DAU, WAU, D28 retention, and paid conversion — computed live from raw events." },
              { icon: <Zap className="w-5 h-5 text-amber-400" />,          title: "AI Email Drafts",  desc: "Claude writes personalised re-engagement emails based on each user's journey." },
              { icon: <Activity className="w-5 h-5 text-rose-400" />,      title: "Returning Users",  desc: "Feature adoption bars showing which returning users are actually using the product." },
              { icon: <BarChart3 className="w-5 h-5 text-teal-400" />,     title: "Churn Prediction", desc: "Risk scored 0–100 from recency, depth, funnel stage, and plan — updated live." },
            ].map((f) => (
              <div key={f.title} className="text-left bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <div className="mb-3">{f.icon}</div>
                <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Churn Risk Methodology ─────────────────────────────────────── */}
        <div className="mt-24 w-full max-w-3xl">
          <div className="text-center mb-10">
            <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">Methodology</span>
            <h2 className="mt-2 text-2xl font-bold text-white">How we calculate Churn Risk</h2>
            <p className="mt-3 text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
              Every user gets a score from <span className="text-zinc-300">0 to 100</span> computed live from four signals.
              The higher the score, the more likely they are to churn.
            </p>
          </div>

          {/* Score bands */}
          <div className="grid grid-cols-3 gap-3 mb-10">
            {[
              { label: "Healthy",  range: "0 – 30",  color: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-900/40", bg: "bg-emerald-950/30", desc: "Actively engaged, on track." },
              { label: "At Risk",  range: "31 – 60", color: "bg-amber-500",   text: "text-amber-400",   border: "border-amber-900/40",   bg: "bg-amber-950/30",   desc: "Slowing down, needs attention." },
              { label: "Critical", range: "61 – 100",color: "bg-rose-500",    text: "text-rose-400",    border: "border-rose-900/40",    bg: "bg-rose-950/30",    desc: "Likely churned or about to." },
            ].map((b) => (
              <div key={b.label} className={`rounded-xl border ${b.border} ${b.bg} p-4 text-center`}>
                <div className={`inline-block w-2.5 h-2.5 rounded-full ${b.color} mb-2`} />
                <p className={`text-sm font-bold ${b.text}`}>{b.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">{b.range}</p>
                <p className="text-[11px] text-zinc-600 mt-2 leading-snug">{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Four signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Signal 1 — Funnel Stage */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Funnel Stage</p>
                  <p className="text-[11px] text-zinc-600">Up to +35 pts</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { stage: "Reached paywall / checkout",    pts: "+0",  color: "text-emerald-400" },
                  { stage: "Used core features",            pts: "+10", color: "text-emerald-400" },
                  { stage: "Completed onboarding",          pts: "+20", color: "text-amber-400"   },
                  { stage: "Registered only",               pts: "+35", color: "text-rose-400"    },
                ].map((r) => (
                  <div key={r.stage} className="flex items-center justify-between">
                    <span className="text-zinc-500">{r.stage}</span>
                    <span className={`font-mono font-semibold ${r.color}`}>{r.pts}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-700 mt-3 leading-snug">
                Users who reached the paywall are not at risk from stage alone — they showed intent to pay.
              </p>
            </div>

            {/* Signal 2 — Recency */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-900/40 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Recency</p>
                  <p className="text-[11px] text-zinc-600">Up to +35 pts</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "Active today",           pts: "+0",  color: "text-emerald-400" },
                  { label: "Last seen 2 days ago",   pts: "+18", color: "text-amber-400"   },
                  { label: "Last seen 4 days ago",   pts: "+35", color: "text-rose-400"    },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-zinc-500">{r.label}</span>
                    <span className={`font-mono font-semibold ${r.color}`}>{r.pts}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-700 mt-3 leading-snug">
                Score = days × 9, capped at 35. A user gone 4+ days already hits the ceiling.
              </p>
            </div>

            {/* Signal 3 — Engagement Depth */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-violet-950/60 border border-violet-900/40 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Engagement Depth</p>
                  <p className="text-[11px] text-zinc-600">Up to +15 pts</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "30+ total events",  pts: "+0",  color: "text-emerald-400" },
                  { label: "15–29 events",       pts: "+3",  color: "text-emerald-400" },
                  { label: "5–14 events",        pts: "+8",  color: "text-amber-400"   },
                  { label: "Fewer than 5 events",pts: "+15", color: "text-rose-400"    },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-zinc-500">{r.label}</span>
                    <span className={`font-mono font-semibold ${r.color}`}>{r.pts}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-700 mt-3 leading-snug">
                Raw event count as a proxy for how deeply the user explored the product.
              </p>
            </div>

            {/* Signal 4 — Plan */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-teal-950/60 border border-teal-900/40 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Plan Type</p>
                  <p className="text-[11px] text-zinc-600">Up to +15 pts</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "Paid / Pro / Business",  pts: "+0",  color: "text-emerald-400" },
                  { label: "Trial / Free / other",   pts: "+10", color: "text-amber-400"   },
                  { label: "No plan detected",        pts: "+15", color: "text-rose-400"    },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-zinc-500">{r.label}</span>
                    <span className={`font-mono font-semibold ${r.color}`}>{r.pts}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-700 mt-3 leading-snug">
                Paid users have skin in the game — they're inherently less likely to disappear overnight.
              </p>
            </div>
          </div>

          {/* Formula callout */}
          <div className="mt-6 bg-zinc-900/40 border border-zinc-800 rounded-xl px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="font-mono text-sm text-zinc-300 whitespace-nowrap">
              Score = Stage + Recency + Depth + Plan
            </div>
            <div className="text-zinc-700 hidden sm:block">·</div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              All four signals are summed and capped at 100. Scores update every time the page loads — no pre-computed cache.
            </p>
          </div>
        </div>
      </main>

      <footer className="px-8 py-5 border-t border-zinc-800/60 flex items-center justify-between mt-12">
        <span className="text-xs text-zinc-700">FunnelMind · OutX.AI internal tool</span>
        <span className="text-xs text-zinc-700">Access restricted · team password required</span>
      </footer>
    </div>
  );
}
