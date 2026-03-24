"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import RetentionOrb from "@/components/ui/retention-orb";
import { cn } from "@/lib/utils";

/* ─── Pipeline Tree Diagram ──────────────────────────────────────────────── */

function PipelineTree() {
  const node = (label: string, sub: string, color: string) => (
    <div className={`rounded-lg border px-3 py-2 text-center min-w-[130px] ${color}`}>
      <div className="text-xs font-semibold text-zinc-100">{label}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );

  const arrow = () => (
    <div className="flex flex-col items-center gap-0">
      <div className="w-px h-5 bg-zinc-700" />
      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-zinc-700" />
    </div>
  );

  const hline = () => <div className="h-px w-8 bg-zinc-700 self-center" />;

  return (
    <div className="flex flex-col items-center gap-0 select-none text-left">

      {/* Layer 1: Source */}
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Data source</div>
      {node("Mixpanel API", "NDJSON stream export", "bg-amber-950/40 border-amber-800/50")}
      {arrow()}

      {/* Layer 2: Ingestion */}
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Ingestion (Python)</div>
      {node("mixpanel_api.py", "fetch → parse → write", "bg-orange-950/40 border-orange-800/50")}
      {arrow()}

      {/* Layer 3: Raw storage — split */}
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Raw storage (Supabase)</div>
      <div className="flex items-start gap-0">
        {/* Left branch */}
        <div className="flex flex-col items-center">
          {node("raw_events", "86k+ rows\ninsert_id dedup", "bg-blue-950/40 border-blue-800/50")}
        </div>
        <div className="flex flex-col items-center self-stretch justify-center">
          {hline()}
          <div className="w-px flex-1 bg-zinc-700" />
          {hline()}
        </div>
        <div className="flex flex-col items-center">
          {node("users", "profile data\ndistinct_id keyed", "bg-blue-950/40 border-blue-800/50")}
        </div>
      </div>

      {/* Converge lines */}
      <div className="flex items-start gap-0">
        <div className="flex flex-col items-center" style={{ width: 130 }}>
          <div className="w-px h-4 bg-zinc-700 ml-auto mr-0" style={{ marginRight: "calc(50% - 0.5px)" }} />
        </div>
        <div className="w-8 self-start" />
        <div className="flex flex-col items-center" style={{ width: 130 }}>
          <div className="w-px h-4 bg-zinc-700" style={{ marginLeft: "calc(50% - 0.5px)" }} />
        </div>
      </div>
      {/* Single converge point arrow */}
      <div className="flex flex-col items-center -mt-1">
        <div className="w-px h-3 bg-zinc-700" />
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-zinc-700" />
      </div>

      {/* Layer 4: Compute */}
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Compute (Python)</div>
      {node("snapshots.py", "load → dedup → score", "bg-violet-950/40 border-violet-800/50")}
      {arrow()}

      {/* Layer 5: Pre-computed storage — split */}
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Pre-computed (Supabase)</div>
      <div className="flex items-start gap-0">
        <div className="flex flex-col items-center">
          {node("user_snapshots", "~7,923 rows\nper user", "bg-indigo-950/40 border-indigo-800/50")}
        </div>
        <div className="flex flex-col items-center self-stretch justify-center">
          {hline()}
          <div className="w-px flex-1 bg-zinc-700" />
          {hline()}
        </div>
        <div className="flex flex-col items-center">
          {node("metrics_daily", "per-date\nDAU + funnel", "bg-indigo-950/40 border-indigo-800/50")}
        </div>
      </div>

      {/* Converge again */}
      <div className="flex items-start gap-0">
        <div className="flex flex-col items-center" style={{ width: 130 }}>
          <div className="w-px h-4 bg-zinc-700" style={{ marginLeft: "calc(50% - 0.5px)" }} />
        </div>
        <div className="w-8 self-start" />
        <div className="flex flex-col items-center" style={{ width: 130 }}>
          <div className="w-px h-4 bg-zinc-700" style={{ marginLeft: "calc(50% - 0.5px)" }} />
        </div>
      </div>
      <div className="flex flex-col items-center -mt-1">
        <div className="w-px h-3 bg-zinc-700" />
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-zinc-700" />
      </div>

      {/* Layer 6: API */}
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">API Routes (Next.js)</div>
      {node("API Routes", "funnel-health · user-behaviour\nuser-story · dashboard", "bg-teal-950/40 border-teal-800/50")}
      {arrow()}

      {/* Layer 7: UI */}
      <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">Dashboard (Vercel)</div>
      {node("FunnelMind UI", "retention-agent.vercel.app", "bg-emerald-950/40 border-emerald-800/50")}
    </div>
  );
}

/* ─── Churn Score Breakdown ──────────────────────────────────────────────── */

function ChurnScoreBreakdown() {
  const bars = [
    { label: "Funnel stage",      max: 35, color: "bg-violet-500", items: [
      { name: "Payment reached",     pts: 0  },
      { name: "Watchlist / Prompts", pts: 10 },
      { name: "AI Onboarding",       pts: 20 },
      { name: "Got into app",        pts: 28 },
      { name: "Only signed up",      pts: 35 },
    ]},
    { label: "Days inactive",     max: 35, color: "bg-amber-500",  items: [
      { name: "0 days",   pts: 0  },
      { name: "2 days",   pts: 18 },
      { name: "4 days",   pts: 35 },
    ]},
    { label: "Event volume",      max: 15, color: "bg-blue-500",   items: [
      { name: "30+ events", pts: 0  },
      { name: "15 events",  pts: 3  },
      { name: "5 events",   pts: 8  },
      { name: "<5 events",  pts: 15 },
    ]},
    { label: "Plan type",         max: 15, color: "bg-rose-500",   items: [
      { name: "Paid plan",     pts: 0  },
      { name: "Free / trial",  pts: 10 },
      { name: "Unknown plan",  pts: 15 },
    ]},
  ];

  return (
    <div className="space-y-5">
      {bars.map((b) => (
        <div key={b.label}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-300">{b.label}</span>
            <span className="text-xs text-zinc-600">max +{b.max} pts</span>
          </div>
          <div className="space-y-1.5">
            {b.items.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-32 text-[11px] text-zinc-500 shrink-0">{item.name}</div>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${b.color} opacity-80`}
                    style={{ width: `${(item.pts / b.max) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-zinc-500 w-12 text-right">+{item.pts}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-4 pt-4 border-t border-zinc-800 space-y-1.5">
        <div className="text-xs font-medium text-zinc-400 mb-2">Risk thresholds</div>
        {[
          { range: "≥ 61", label: "Critical", color: "bg-rose-500", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
          { range: "31–60", label: "At Risk",  color: "bg-amber-400", badge: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
          { range: "≤ 30", label: "Healthy",  color: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${t.color} shrink-0`} />
            <span className="text-[11px] text-zinc-500 w-12">{t.range}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${t.badge}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/60 text-[11px] text-zinc-500 leading-relaxed">
        <span className="font-mono text-indigo-400">score = </span>
        stage_weight + min(days × 9, 35) + event_penalty + plan_penalty
        <br />
        <span className="text-zinc-700">capped at 100 · recomputed each time snapshots.py runs</span>
      </div>
    </div>
  );
}

/* ─── Assumptions list ───────────────────────────────────────────────────── */

function AssumptionsList() {
  const items = [
    {
      title: "user_type = 'new'",
      body: "A user is classified as new if a user_registered event exists anywhere in the dataset. No such event = old/returning user (signed up before our data window).",
      flag: "Identity",
    },
    {
      title: "Email deduplication",
      body: "Mixpanel creates separate distinct_ids for anonymous pre-login sessions and identified post-login sessions. We merge all rows sharing the same email into one. Primary row = highest plan rank, most events.",
      flag: "Dedup",
    },
    {
      title: "signup_date NULL for some new users",
      body: "Some users have user_type='new' but signup_date = NULL. This causes them to be excluded from funnel date-range filters (NULL BETWEEN x AND y = false). ~11 users affected. Known bug, unresolved.",
      flag: "Bug",
      isBug: true,
    },
    {
      title: "52 total extension installs ≠ 41 in New User funnel",
      body: "52 = all users with reached_extension=TRUE across the entire dataset. 41 = new users who signed up in the selected date range AND installed the extension. The 11 difference are old/returning users or users with NULL signup_date.",
      flag: "Expected",
    },
    {
      title: "days_since_last is relative, not absolute",
      body: "Computed as (latest event in entire dataset − user's last event) ÷ 86400. Not relative to today's date. Churn scores drift if the compute script isn't re-run after new ingestion.",
      flag: "Recency",
    },
    {
      title: "78 extension install events → 52 unique users",
      body: "Some users installed the extension multiple times (reinstall). JOIN on raw_events returns all events. Always use MIN(occurred_at) to get the first install per user.",
      flag: "Dedup",
    },
    {
      title: "IST → UTC conversion",
      body: "The UI sends IST dates. The funnel-health API subtracts 5.5 hours so March 6 00:00 IST maps to March 5 18:30 UTC, catching all events that belong to March 6 in India.",
      flag: "Timezone",
    },
    {
      title: "AI story is cached daily",
      body: "user-story API generates a narrative via Claude Haiku (OpenRouter). The story is saved to user_snapshots.story + story_generated_date. If generated today, cached version is returned — no AI call.",
      flag: "Cache",
    },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.title}
          className={cn(
            "rounded-xl border p-4",
            item.isBug
              ? "bg-rose-950/20 border-rose-900/40"
              : "bg-zinc-900/60 border-zinc-800/60"
          )}
        >
          <div className="flex items-start gap-3">
            <span className={cn(
              "inline-block text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 mt-0.5",
              item.isBug
                ? "bg-rose-900/50 text-rose-400"
                : "bg-zinc-800 text-zinc-500"
            )}>
              {item.flag}
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-200 mb-1">{item.title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{item.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── ScrollOrb (adapted from template) ─────────────────────────────────── */

interface Section {
  id: string;
  badge: string;
  renderContent: () => React.ReactNode;
  align?: "left" | "center" | "right";
}

function ScrollOrb({ sections }: { sections: Section[] }) {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [orbStyle, setOrbStyle] = useState<React.CSSProperties>({});
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const rafRef = useRef<number | undefined>(undefined);

  const positions = [
    { top: 50, left: 72, scale: 1.3 },
    { top: 50, left: 28, scale: 1.0 },
    { top: 50, left: 75, scale: 1.1 },
    { top: 50, left: 25, scale: 1.2 },
  ];

  const update = useCallback(() => {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    setScrollProgress(Math.min(Math.max(scrollTop / docHeight, 0), 1));

    const center = window.innerHeight / 2;
    let best = 0;
    let minDist = Infinity;
    sectionRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      const d = Math.abs(rect.top + rect.height / 2 - center);
      if (d < minDist) { minDist = d; best = i; }
    });

    setActiveSection(best);
    const p = positions[best] ?? positions[0];
    setOrbStyle({
      transform: `translate3d(${p.left}vw, ${p.top}vh, 0) translate3d(-50%, -50%, 0) scale(${p.scale})`,
    });
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, [update]);

  return (
    <div className="relative w-full bg-zinc-950 text-white overflow-x-hidden">

      {/* Progress bar */}
      <div className="fixed top-0 left-0 w-full h-0.5 bg-zinc-900 z-50">
        <div
          className="h-full bg-indigo-500"
          style={{ transform: `scaleX(${scrollProgress})`, transformOrigin: "left center", transition: "transform 0.15s ease-out" }}
        />
      </div>

      {/* Section nav dots */}
      <div className="hidden sm:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col gap-4">
        {sections.map((s, i) => (
          <button
            key={s.id}
            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className={cn(
              "w-2 h-2 rounded-full border-2 transition-all duration-300",
              activeSection === i
                ? "bg-indigo-500 border-indigo-500 scale-125"
                : "bg-transparent border-zinc-600 hover:border-indigo-400"
            )}
            title={s.badge}
          />
        ))}
      </div>

      {/* Floating orb */}
      <div
        className="fixed z-10 pointer-events-none"
        style={{
          ...orbStyle,
          transition: "transform 1200ms cubic-bezier(0.23,1,0.32,1)",
          opacity: 0.82,
        }}
      >
        <RetentionOrb />
      </div>

      {/* Sections */}
      {sections.map((section, i) => (
        <section
          key={section.id}
          ref={(el) => { sectionRefs.current[i] = el; }}
          className={cn(
            "relative min-h-screen flex flex-col justify-center z-20 px-8 py-20",
            section.align === "center" && "items-center text-center",
            section.align === "right" && "items-end",
            (!section.align || section.align === "left") && "items-start"
          )}
        >
          <div className="w-full max-w-xl">
            {section.renderContent()}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function PipelinePage() {
  const sections: Section[] = [
    {
      id: "hero",
      badge: "FunnelMind",
      align: "left",
      renderContent: () => (
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            OutX.AI · Retention Intelligence
          </div>
          <h1 className="text-5xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="text-white">Know before</span>
            <br />
            <span className="text-zinc-500">they leave.</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            FunnelMind tracks every user from their first Mixpanel event to their last, computes a real-time churn risk score, and tells you exactly who needs attention and why.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "7,923 users tracked", color: "text-indigo-400 border-indigo-800/50 bg-indigo-950/30" },
              { label: "52 extension installs", color: "text-emerald-400 border-emerald-800/50 bg-emerald-950/30" },
              { label: "Data window: Mar 7–22", color: "text-zinc-400 border-zinc-800 bg-zinc-900/30" },
            ].map((chip) => (
              <span key={chip.label} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${chip.color}`}>
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      ),
    },

    {
      id: "pipeline",
      badge: "Pipeline",
      align: "right",
      renderContent: () => (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">How data moves</div>
          <h2 className="text-3xl font-bold text-white mb-3">The Pipeline</h2>
          <p className="text-zinc-500 text-sm leading-relaxed mb-8">
            Raw events flow from Mixpanel into Supabase, get pre-computed into snapshots once, then serve all dashboard queries instantly — no paginating 86k rows on every page load.
          </p>
          <PipelineTree />
          <div className="mt-6 grid grid-cols-2 gap-2 text-[11px]">
            {[
              { label: "Ingestion", color: "bg-amber-950/40 border-amber-800/50 text-amber-500" },
              { label: "Raw storage", color: "bg-blue-950/40 border-blue-800/50 text-blue-400" },
              { label: "Compute", color: "bg-violet-950/40 border-violet-800/50 text-violet-400" },
              { label: "Pre-computed", color: "bg-indigo-950/40 border-indigo-800/50 text-indigo-400" },
              { label: "API", color: "bg-teal-950/40 border-teal-800/50 text-teal-400" },
              { label: "Dashboard", color: "bg-emerald-950/40 border-emerald-800/50 text-emerald-400" },
            ].map((l) => (
              <div key={l.label} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${l.color}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      ),
    },

    {
      id: "churn",
      badge: "Churn Score",
      align: "left",
      renderContent: () => (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Risk scoring</div>
          <h2 className="text-3xl font-bold text-white mb-3">The Churn Score</h2>
          <p className="text-zinc-500 text-sm leading-relaxed mb-6">
            Every user gets a 0–100 risk score built from four independent signals. Higher = more likely to churn. Recomputed every time <span className="font-mono text-zinc-400">snapshots.py</span> runs.
          </p>
          <ChurnScoreBreakdown />
        </div>
      ),
    },

    {
      id: "assumptions",
      badge: "Assumptions",
      align: "right",
      renderContent: () => (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">What we know</div>
          <h2 className="text-3xl font-bold text-white mb-3">Decisions & Assumptions</h2>
          <p className="text-zinc-500 text-sm leading-relaxed mb-6">
            Every non-obvious decision made in the pipeline — including known bugs and data gaps — documented so no one has to guess.
          </p>
          <AssumptionsList />
        </div>
      ),
    },
  ];

  return <ScrollOrb sections={sections} />;
}
