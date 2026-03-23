'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { UserFunnelTable } from '@/components/ui/user-funnel-table';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface FunnelStep {
  key: string;
  label: string;
  count: number;
  description: string;
}

import type { UserRow } from '@/components/ui/user-funnel-table';

interface FunnelData {
  new_users:     FunnelStep[];
  old_users:      FunnelStep[];
  new_user_rows: UserRow[];
  old_user_rows:  UserRow[];
  summary: {
    new_user_count:  number;
    old_user_count:  number;
    anonymous_count: number;
    total_devices:   number;
  };
}

/* ─── Derived geometry helpers ───────────────────────────────────────────── */

function buildDrops(steps: FunnelStep[]) {
  return steps.slice(1).map((step, i) => {
    const prev    = steps[i];
    const dropped = prev.count - step.count;
    const pct     = prev.count > 0 ? parseFloat(((dropped / prev.count) * 100).toFixed(1)) : 0;
    const convPct = prev.count > 0 ? parseFloat(((step.count / prev.count) * 100).toFixed(1)) : 0;
    return { fromStep: i, toStep: i + 1, from: prev.label, to: step.label, dropped, pct, convPct };
  });
}

/* ─── Tooltip ────────────────────────────────────────────────────────────── */

function StepTooltip({
  stepIdx, steps, drops, biggestDropToStep, secondDropToStep,
}: {
  stepIdx: number;
  steps: FunnelStep[];
  drops: ReturnType<typeof buildDrops>;
  biggestDropToStep: number;
  secondDropToStep: number;
}) {
  const step          = steps[stepIdx];
  const drop          = stepIdx > 0 ? drops[stepIdx - 1] : null;
  const isBiggest     = stepIdx === biggestDropToStep;
  const isSecond      = stepIdx === secondDropToStep;
  const convFromTotal = steps[0].count > 0
    ? parseFloat(((step.count / steps[0].count) * 100).toFixed(1))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1,  y: 0,  scale: 1    }}
      exit   ={{ opacity: 0,  y: -4, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      className="pointer-events-none"
      style={{ minWidth: 220 }}
    >
      <div className={`w-3 h-3 rotate-45 mx-auto -mb-1.5 border-l border-t
        ${isBiggest ? 'bg-rose-950 border-rose-700' :
          isSecond  ? 'bg-amber-950 border-amber-700' :
                      'bg-zinc-800 border-zinc-700'}`}
      />
      <div className={`rounded-xl border px-4 py-3 shadow-2xl text-sm
        ${isBiggest ? 'bg-rose-950 border-rose-700' :
          isSecond  ? 'bg-amber-950 border-amber-700' :
                      'bg-zinc-800 border-zinc-700'}`}
      >
        {isBiggest && (
          <p className="text-[10px] font-bold text-rose-300 uppercase tracking-widest mb-1.5">
            🚨 Biggest drop here
          </p>
        )}
        {isSecond && !isBiggest && (
          <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-1.5">
            ⚠️ 2nd biggest drop
          </p>
        )}

        <p className="font-semibold text-white">{step.label}</p>
        <p className="text-zinc-500 text-[11px] mt-0.5">{step.description}</p>
        <p className="text-zinc-400 text-xs mt-1">
          <span className="text-white font-mono font-bold">{step.count}</span> users
          {' · '}<span className="font-mono">{convFromTotal}%</span> of total
        </p>

        {drop && (
          <div className={`mt-2 pt-2 border-t text-xs space-y-0.5
            ${isBiggest ? 'border-rose-800' : isSecond ? 'border-amber-800' : 'border-zinc-700'}`}>
            <div className="flex justify-between">
              <span className="text-zinc-400">Conv. from {drop.from}</span>
              <span className="font-mono text-white font-semibold">{drop.convPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Dropped</span>
              <span className={`font-mono font-semibold
                ${isBiggest ? 'text-rose-300' : isSecond ? 'text-amber-300' : 'text-zinc-300'}`}>
                −{drop.pct}% ({drop.dropped} users)
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── SVG Funnel ─────────────────────────────────────────────────────────── */

const SVG_W    = 1200;
const SVG_H    = 260;
const CY       = SVG_H / 2;
const MAX_HALF = SVG_H * 0.44;

function FunnelViz({
  steps, drops, biggestDropToStep, secondDropToStep, onHover,
}: {
  steps: FunnelStep[];
  drops: ReturnType<typeof buildDrops>;
  biggestDropToStep: number;
  secondDropToStep: number;
  onHover: (i: number | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const N = steps.length;
  const SEG_W = SVG_W / N;

  const segments = steps.map((step, i) => {
    const leftProp  = steps[0].count > 0 ? step.count / steps[0].count : 0;
    const rightProp = i < N - 1 && steps[0].count > 0 ? steps[i + 1].count / steps[0].count : leftProp;
    const x0 = i * SEG_W;
    const x1 = (i + 1) * SEG_W;
    return {
      i, step,
      x0, x1, cx: (x0 + x1) / 2,
      yTL: CY - leftProp  * MAX_HALF,
      yBL: CY + leftProp  * MAX_HALF,
      yTR: CY - rightProp * MAX_HALF,
      yBR: CY + rightProp * MAX_HALF,
    };
  });

  const enter = (i: number) => { setHovered(i); onHover(i); };
  const leave = ()           => { setHovered(null); onHover(null); };

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ height: SVG_H, display: 'block', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="fgDefault" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          <filter id="glowBlue"  x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="8"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glowRose"  x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glowAmber" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {segments.map(({ i, x0, x1, cx, yTL, yBL, yTR, yBR }) => {
          const isHov     = hovered === i;
          const isBiggest = i === biggestDropToStep;
          const isSecond  = i === secondDropToStep;

          const fill   = !isHov ? 'url(#fgDefault)'
                       : isBiggest ? '#ef4444'
                       : isSecond  ? '#f59e0b'
                       :             '#818cf8';
          const opacity  = isHov ? 1 : 0.72;
          const filterAttr = !isHov ? undefined
                           : isBiggest ? 'url(#glowRose)'
                           : isSecond  ? 'url(#glowAmber)'
                           :             'url(#glowBlue)';

          return (
            <g key={i}>
              <polygon
                points={`${x0},${yTL} ${x1},${yTR} ${x1},${yBR} ${x0},${yBL}`}
                fill={fill}
                opacity={opacity}
                filter={filterAttr}
                style={{ cursor: 'pointer', transition: 'fill 0.18s, opacity 0.18s' }}
                onMouseEnter={() => enter(i)}
                onMouseLeave={leave}
              />

              {i > 0 && (
                <line x1={x0} y1={yTL} x2={x0} y2={yBL} stroke="#0a0a0a" strokeWidth="3" />
              )}

              {/* User count inside segment */}
              <text
                x={cx} y={CY + 7}
                textAnchor="middle"
                fill="white" fontSize="20" fontWeight="700" fontFamily="monospace"
                opacity={0.9} style={{ pointerEvents: 'none' }}
              >
                {steps[i].count}
              </text>

              {/* Drop badge on divider */}
              {i > 0 && drops[i - 1] && (
                <>
                  <rect
                    x={x0 - 30} y={CY - 13} width="60" height="26" rx="13"
                    fill="#18181b"
                    stroke={isBiggest ? '#ef444488' : isSecond ? '#f59e0b88' : '#3f3f46'}
                    strokeWidth="1" style={{ pointerEvents: 'none' }}
                  />
                  <text
                    x={x0} y={CY + 5}
                    textAnchor="middle"
                    fill={isBiggest ? '#fca5a5' : isSecond ? '#fcd34d' : '#a1a1aa'}
                    fontSize="11" fontWeight="600" fontFamily="monospace"
                    style={{ pointerEvents: 'none' }}
                  >
                    {`-${drops[i - 1].pct}%`}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Step labels */}
      <div className="flex w-full mt-3" onMouseLeave={leave}>
        {segments.map(({ i }) => {
          const isBiggest = i === biggestDropToStep;
          const isSecond  = i === secondDropToStep;
          const convPct   = steps[0].count > 0
            ? parseFloat(((steps[i].count / steps[0].count) * 100).toFixed(1))
            : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-0.5 cursor-default"
              onMouseEnter={() => enter(i)}
            >
              <span className={`text-xs font-medium truncate px-1 text-center
                ${hovered === i
                  ? isBiggest ? 'text-rose-300' : isSecond ? 'text-amber-300' : 'text-white'
                  : 'text-zinc-400'}`}>
                {steps[i].label}
              </span>
              <span className={`text-[10px] font-mono
                ${isBiggest ? 'text-rose-600' : isSecond ? 'text-amber-600' : 'text-zinc-600'}`}>
                {convPct}%
              </span>
              {isBiggest && (
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">↓ biggest drop</span>
              )}
              {isSecond && !isBiggest && (
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">↓ 2nd drop</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Feature Breakdown (Old Users) ─────────────────────────────────────── */

function FeatureBreakdown({ steps }: { steps: FunnelStep[] }) {
  const base = steps[0]?.count ?? 0; // "Came Back" count is the denominator
  const features = steps.slice(1);   // everything after "Came Back"

  const BAR_COLORS = [
    "bg-indigo-500", "bg-violet-500", "bg-blue-500",
    "bg-teal-500",   "bg-amber-500",  "bg-rose-500",
  ];

  return (
    <div className="flex flex-col gap-3 py-2">
      {/* Total came back */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl font-bold font-mono text-white">{base}</span>
        <span className="text-sm text-zinc-500">returning users came back</span>
      </div>

      {/* Feature bars */}
      {features.map((step, i) => {
        const pct = base > 0 ? Math.round((step.count / base) * 100) : 0;
        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-4"
          >
            <span className="text-xs text-zinc-400 w-44 shrink-0 truncate">{step.label}</span>
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-mono text-white w-6 text-right">{step.count}</span>
            <span className="text-xs text-zinc-600 w-10 text-right">{pct}%</span>
          </motion.div>
        );
      })}

      {features.length === 0 && (
        <p className="text-zinc-600 text-sm">No feature data. Check returning funnel blocks in Supabase.</p>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

type Tab = 'new_users' | 'old_users';

export default function FunnelHealthPage() {
  const [data, setData]               = useState<FunnelData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<Tab>('new_users');
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [fromDate, setFromDate]       = useState('2026-03-21');
  const [toDate, setToDate]           = useState('2026-03-22');

  const fetchData = (from: string, to: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    fetch(`/api/funnel-health?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.new_users && d?.old_users && d?.summary) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(fromDate, toDate); }, []);

  const switchTab = (t: Tab) => { setTab(t); setHoveredStep(null); };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const newSteps = data?.new_users ?? [];
  const oldSteps = data?.old_users  ?? [];
  const steps    = tab === 'new_users' ? newSteps : oldSteps;
  const drops    = buildDrops(steps);

  const sortedByDrop      = [...drops].sort((a, b) => b.dropped - a.dropped);
  const biggestDropToStep = sortedByDrop[0]?.toStep ?? -1;
  const secondDropToStep  = sortedByDrop[1]?.toStep ?? -1;

  const N = steps.length;
  const endToEnd = steps.length > 1 && steps[0].count > 0
    ? parseFloat(((steps[steps.length - 1].count / steps[0].count) * 100).toFixed(1))
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Funnel Health</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            OutX.AI · user journey ·{' '}
            {tab === 'new_users'
              ? `${data?.summary?.new_user_count ?? 0} new users`
              : `${data?.summary?.old_user_count ?? 0} returning users`}
            {fromDate && toDate ? ` · ${fromDate} → ${toDate}` : ''}
          </p>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
            <span className="text-zinc-500 text-xs">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 outline-none [color-scheme:dark]"
            />
            <span className="text-zinc-600">→</span>
            <span className="text-zinc-500 text-xs">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 outline-none [color-scheme:dark]"
            />
            <button
              onClick={() => fetchData(fromDate, toDate)}
              className="ml-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {([
            { id: 'new_users' as Tab, label: 'New Users',      sub: 'Signed up today' },
            { id: 'old_users' as Tab, label: 'Old Users',      sub: 'Returning today'  },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex flex-col items-center px-5 py-2 rounded-lg text-xs font-medium transition-all
                ${tab === t.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
            >
              <span className="font-semibold">{t.label}</span>
              <span className="text-[10px] opacity-70">{t.sub}</span>
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Context banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="mx-8 mb-4 shrink-0"
        >
          {(() => {
            const stepsToShow = tab === 'new_users' ? newSteps : oldSteps;
            const colors = ["text-indigo-300", "text-violet-300", "text-blue-300", "text-emerald-300", "text-amber-300"];
            return (
              <div className="flex gap-6 bg-zinc-900/60 border border-zinc-800 rounded-xl px-5 py-3 flex-wrap">
                {stepsToShow.map((step, i) => (
                  <React.Fragment key={step.key}>
                    {i > 0 && <div className="w-px bg-zinc-800" />}
                    <Stat label={step.label} value={step.count} color={colors[i % colors.length]} />
                  </React.Fragment>
                ))}
                <div className="w-px bg-zinc-800" />
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest">What this shows</span>
                  <span className="text-xs text-zinc-400 mt-0.5">
                    {tab === 'new_users' ? 'Every user who signed up and where they got to' : 'Returning users — are they progressing or stuck?'}
                  </span>
                </div>
              </div>
            );
          })()}
        </motion.div>
      </AnimatePresence>

      {/* Funnel SVG (new users) or Feature bars (old users) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab + '-viz'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="px-8 pt-2 shrink-0"
        >
          {tab === 'new_users' ? (
            steps.length > 0 ? (
              <FunnelViz
                steps={steps}
                drops={drops}
                biggestDropToStep={biggestDropToStep}
                secondDropToStep={secondDropToStep}
                onHover={setHoveredStep}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-zinc-600 text-sm">No data available</div>
            )
          ) : (
            <FeatureBreakdown steps={oldSteps} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Tooltip row — new users only */}
      {tab === 'new_users' && (
        <div className="flex w-full px-8 mt-3 min-h-[110px]">
          <AnimatePresence mode="wait">
            {hoveredStep !== null && steps.length > 0 && (
              <div
                key={`${tab}-${hoveredStep}`}
                className="w-full flex"
                style={{
                  justifyContent: hoveredStep === 0 ? 'flex-start'
                                : hoveredStep === N - 1 ? 'flex-end'
                                : 'center',
                  paddingLeft:  hoveredStep === 0 ? `${(0.5 / N) * 100}%` : undefined,
                  paddingRight: hoveredStep === N - 1 ? `${(0.5 / N) * 100}%` : undefined,
                }}
              >
                <StepTooltip
                  stepIdx={hoveredStep}
                  steps={steps}
                  drops={drops}
                  biggestDropToStep={biggestDropToStep}
                  secondDropToStep={secondDropToStep}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Drop stats — new users only */}
      {tab === 'new_users' && (
        <>
          <div className="h-px bg-zinc-800 mx-8 mb-6 shrink-0" />
          {sortedByDrop.length >= 2 && (
            <div className="grid grid-cols-2 gap-6 px-8 pb-6 shrink-0">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-sm text-zinc-400 font-medium">Biggest Drop</span>
                </div>
                <div className="flex items-end gap-3">
                  <CountUp className="font-mono text-5xl font-bold text-white" start={0} end={sortedByDrop[0].dropped} duration={2} />
                  <span className="text-zinc-500 text-base mb-1.5">users lost</span>
                </div>
                <div className="flex items-center gap-1 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-full text-rose-300 text-xs font-semibold w-fit">
                  ↓ {sortedByDrop[0].pct}% drop-off
                </div>
                <span className="text-zinc-600 text-xs">{sortedByDrop[0].from} → {sortedByDrop[0].to}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm text-zinc-400 font-medium">2nd Biggest Drop</span>
                </div>
                <div className="flex items-end gap-3">
                  <CountUp className="font-mono text-5xl font-bold text-white" start={0} end={sortedByDrop[1].dropped} duration={2} />
                  <span className="text-zinc-500 text-base mb-1.5">users lost</span>
                </div>
                <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full text-amber-300 text-xs font-semibold w-fit">
                  ↓ {sortedByDrop[1].pct}% drop-off
                </div>
                <span className="text-zinc-600 text-xs">{sortedByDrop[1].from} → {sortedByDrop[1].to}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col px-8 font-mono divide-y divide-zinc-800/60 border-t border-zinc-800">
            {[
              sortedByDrop[0] && { dot: 'bg-rose-500', label: `Biggest drop · ${sortedByDrop[0].from} → ${sortedByDrop[0].to}`, value: `${sortedByDrop[0].pct}%`, badge: `↓ ${sortedByDrop[0].pct}%`, cls: 'bg-rose-500/15 border-rose-500/30 text-rose-300' },
              sortedByDrop[1] && { dot: 'bg-amber-500', label: `2nd drop · ${sortedByDrop[1].from} → ${sortedByDrop[1].to}`, value: `${sortedByDrop[1].pct}%`, badge: `↓ ${sortedByDrop[1].pct}%`, cls: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
              { dot: 'bg-teal-500', label: 'End-to-end conversion', value: `${endToEnd}%`, badge: `${endToEnd}%`, cls: 'bg-teal-500/15 border-teal-500/30 text-teal-300' },
            ].filter(Boolean).map((row, idx) => (
              <motion.div key={row!.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }} className="flex w-full py-4 items-center">
                <div className="flex items-center gap-2.5 w-1/2 text-sm text-zinc-500">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row!.dot}`} />
                  <span className="truncate">{row!.label}</span>
                </div>
                <div className="flex items-center justify-end gap-3 w-1/2">
                  <span className="text-lg font-semibold text-white">{row!.value}</span>
                  <div className={`border px-2.5 py-0.5 rounded-full text-xs font-semibold ${row!.cls}`}>{row!.badge}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* User table */}
      <UserFunnelTable
        rows={tab === 'new_users' ? (data?.new_user_rows ?? []) : (data?.old_user_rows ?? [])}
        tab={tab}
      />

    </div>
  );
}

/* ─── Mini stat ──────────────────────────────────────────────────────────── */

function Stat({ label, value, color, isText }: { label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div className="flex flex-col justify-center">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className={`text-lg font-bold font-mono mt-0.5 ${color}`}>
        {isText ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
