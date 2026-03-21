"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Star, StarOff, TargetIcon, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

/* ─── Variable definitions ───────────────────────────────────────────────── */

// These are resolved from /api/funnel-health at runtime
type VarMap = Record<string, number>;

const VAR_DESCRIPTIONS: Record<string, string> = {
  new_users:              "Devices that signed up today",
  returning_users:        "Returning identified users today",
  anonymous_users:        "Anonymous website visitors",
  total_devices:          "All unique devices seen today",
  got_into_app:           "New users who reached the app",
  completed_onboarding:   "New users who did AI Onboarding",
  used_watchlist:         "New users who used Watchlist/Prompts",
  reached_payment:        "New users who saw the payment screen",
  ret_onboarding:         "Returning users who did AI Onboarding",
  ret_watchlist:          "Returning users who used Watchlist/Prompts",
  ret_payment:            "Returning users who saw payment screen",
};

/* ─── Custom metric type ─────────────────────────────────────────────────── */

type GoalDir = "above" | "below";
type Unit    = "%" | "number" | "ratio";

type CustomMetric = {
  id: string;
  name: string;
  formula: string;
  unit: Unit;
  isGoal: boolean;
  goalTarget?: number;
  goalDirection: GoalDir;
  createdAt: string;
};

/* ─── Persistence ────────────────────────────────────────────────────────── */

const STORAGE_KEY = "funnelmind_metrics_v1";

function loadMetrics(): CustomMetric[] {
  if (typeof window === "undefined") return DEFAULT_METRICS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_METRICS;
  } catch { return DEFAULT_METRICS; }
}

function saveMetrics(metrics: CustomMetric[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics)); } catch {}
}

/* ─── Default metrics ────────────────────────────────────────────────────── */

const DEFAULT_METRICS: CustomMetric[] = [
  {
    id: "m-001",
    name: "New User → App Entry Rate",
    formula: "got_into_app / new_users * 100",
    unit: "%",
    isGoal: true,
    goalTarget: 80,
    goalDirection: "above",
    createdAt: "Mar 1, 2026",
  },
  {
    id: "m-002",
    name: "Onboarding Completion Rate",
    formula: "completed_onboarding / new_users * 100",
    unit: "%",
    isGoal: true,
    goalTarget: 60,
    goalDirection: "above",
    createdAt: "Mar 1, 2026",
  },
  {
    id: "m-003",
    name: "New User Payment Conversion",
    formula: "reached_payment / new_users * 100",
    unit: "%",
    isGoal: false,
    goalDirection: "above",
    createdAt: "Mar 1, 2026",
  },
  {
    id: "m-004",
    name: "Returning User Engagement",
    formula: "ret_watchlist / returning_users * 100",
    unit: "%",
    isGoal: false,
    goalDirection: "above",
    createdAt: "Mar 5, 2026",
  },
];

/* ─── Formula evaluator ──────────────────────────────────────────────────── */

function evalFormula(formula: string, vars: VarMap): number | null {
  try {
    let expr = formula.trim();
    // Replace variable names with their numeric values
    for (const [key, val] of Object.entries(vars)) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, "g"), String(val));
    }
    // Safety check: only allow math characters after substitution
    if (!/^[\d\s+\-*/.()]+$/.test(expr)) return null;
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (!isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch { return null; }
}

function validateFormula(formula: string, vars: VarMap): { ok: boolean; result: number | null; error: string } {
  if (!formula.trim()) return { ok: false, result: null, error: "Enter a formula" };
  // Check for unknown variable names
  const usedVars = formula.match(/\b[a-z_]+\b/g) ?? [];
  const unknown = usedVars.filter(v => !(v in vars));
  if (unknown.length > 0) return { ok: false, result: null, error: `Unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}` };
  const result = evalFormula(formula, vars);
  if (result === null) return { ok: false, result: null, error: "Formula error — check syntax" };
  return { ok: true, result, error: "" };
}

/* ─── Format value ───────────────────────────────────────────────────────── */

function fmt(value: number | null, unit: Unit): string {
  if (value === null) return "—";
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "ratio") return value.toFixed(3);
  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
}

/* ─── Goal progress bar ──────────────────────────────────────────────────── */

function GoalProgress({ current, target, dir, unit }: { current: number | null; target: number; dir: GoalDir; unit: Unit }) {
  if (current === null) return <p className="text-[11px] text-zinc-600">No data</p>;
  const pct = dir === "above"
    ? Math.min((current / target) * 100, 150)
    : Math.min((target / Math.max(current, 0.001)) * 100, 150);
  const hit = dir === "above" ? current >= target : current <= target;
  const barColor = hit ? "bg-emerald-500" : pct >= 80 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-zinc-500">
          Target: {fmt(target, unit)} {dir === "above" ? "or more" : "or less"}
        </span>
        <span className={`text-[10px] font-semibold ${hit ? "text-emerald-400" : "text-zinc-500"}`}>
          {hit ? "On track" : `${Math.round(pct)}% there`}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ─── Metric card (goal metrics) ─────────────────────────────────────────── */

function GoalMetricCard({
  metric, value, onToggleGoal, onDelete,
}: {
  metric: CustomMetric;
  value: number | null;
  onToggleGoal: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{metric.name}</p>
          <p className="text-[11px] text-zinc-600 font-mono mt-0.5 truncate">{metric.formula}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggleGoal} title="Unset as goal" className="w-6 h-6 flex items-center justify-center text-amber-400 hover:text-zinc-500 transition-colors rounded-md hover:bg-zinc-800">
            <Star className="w-3.5 h-3.5 fill-current" />
          </button>
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-rose-400 transition-colors rounded-md hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">Current</p>
          <p className="text-2xl font-bold text-zinc-100 font-mono">{fmt(value, metric.unit)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">Target</p>
          <p className="text-lg font-semibold text-zinc-400 font-mono">
            {metric.goalTarget !== undefined ? fmt(metric.goalTarget, metric.unit) : "—"}
          </p>
        </div>
      </div>

      {metric.goalTarget !== undefined && (
        <GoalProgress current={value} target={metric.goalTarget} dir={metric.goalDirection} unit={metric.unit} />
      )}
    </div>
  );
}

/* ─── Metric row (non-goal metrics) ─────────────────────────────────────── */

function MetricRow({
  metric, value, onToggleGoal, onDelete,
}: {
  metric: CustomMetric;
  value: number | null;
  onToggleGoal: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">{metric.name}</p>
        <p className="text-[11px] text-zinc-600 font-mono truncate">{metric.formula}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-mono font-semibold text-zinc-100 w-16 text-right">
          {fmt(value, metric.unit)}
        </span>
        <button
          onClick={onToggleGoal}
          title="Set as goal metric"
          className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100 rounded-md hover:bg-amber-500/10"
        >
          <StarOff className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 rounded-md hover:bg-rose-500/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Variables reference panel ──────────────────────────────────────────── */

function VarsPanel({ vars }: { vars: VarMap }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Available variables</span>
          <span className="text-[10px] text-zinc-600">— use these in your formulas</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800"
          >
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(VAR_DESCRIPTIONS).map(([key, desc]) => (
                <div key={key} className="bg-zinc-800/40 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-mono font-semibold text-indigo-300 mb-0.5">{key}</p>
                  <p className="text-[10px] text-zinc-500 leading-tight">{desc}</p>
                  <p className="text-[11px] font-mono text-zinc-300 mt-1">
                    = {vars[key] !== undefined ? vars[key] : "…"}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── New metric modal ───────────────────────────────────────────────────── */

function NewMetricModal({
  vars,
  onCreate,
  onClose,
}: {
  vars: VarMap;
  onCreate: (m: Omit<CustomMetric, "id" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [name, setName]           = useState("");
  const [formula, setFormula]     = useState("");
  const [unit, setUnit]           = useState<Unit>("%");
  const [isGoal, setIsGoal]       = useState(false);
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDir, setGoalDir]     = useState<GoalDir>("above");

  const validation = validateFormula(formula, vars);

  const canSave = name.trim() && validation.ok && (!isGoal || goalTarget.trim() !== "");

  const handleSave = () => {
    onCreate({
      name: name.trim(),
      formula: formula.trim(),
      unit,
      isGoal,
      goalTarget: isGoal && goalTarget ? parseFloat(goalTarget) : undefined,
      goalDirection: goalDir,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <p className="text-sm font-semibold text-zinc-100">New metric</p>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded-md hover:bg-zinc-800 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">Metric name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="E.g. Watchlist Setup Rate"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Formula */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">Formula</label>
            <div className="relative">
              <input
                value={formula}
                onChange={e => setFormula(e.target.value)}
                placeholder="E.g. got_into_app / new_users * 100"
                className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors ${
                  formula && !validation.ok ? "border-rose-500/60 focus:border-rose-500" :
                  formula && validation.ok  ? "border-emerald-500/60 focus:border-emerald-500" :
                  "border-zinc-700 focus:border-indigo-500"
                }`}
              />
            </div>
            {/* Live preview */}
            {formula && (
              <div className="mt-1.5 flex items-center gap-2">
                {validation.ok ? (
                  <p className="text-[11px] text-emerald-400 font-mono">
                    = {fmt(validation.result, unit)} <span className="text-zinc-500">(with today&apos;s data)</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-rose-400">{validation.error}</p>
                )}
              </div>
            )}
            {/* Quick examples */}
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                "got_into_app / new_users * 100",
                "reached_payment / new_users * 100",
                "ret_watchlist / returning_users * 100",
                "completed_onboarding / new_users * 100",
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => setFormula(ex)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded px-2 py-0.5 font-mono transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">Unit</label>
            <div className="flex gap-2">
              {(["%" , "number", "ratio"] as Unit[]).map(u => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${unit === u ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}
                >
                  {u === "%" ? "Percentage (%)" : u === "number" ? "Count" : "Ratio (0–1)"}
                </button>
              ))}
            </div>
          </div>

          {/* Goal toggle */}
          <div className="flex items-start gap-3 pt-1 border-t border-zinc-800">
            <button
              onClick={() => setIsGoal(v => !v)}
              className={`mt-0.5 w-8 h-4.5 rounded-full relative transition-colors flex-shrink-0 ${isGoal ? "bg-amber-500" : "bg-zinc-700"}`}
              style={{ height: "18px" }}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isGoal ? "left-4" : "left-0.5"}`} />
            </button>
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-300">Set as goal metric</p>
              <p className="text-[11px] text-zinc-600">Shows on goals dashboard with progress tracking</p>
            </div>
          </div>

          {/* Goal target (only if goal) */}
          <AnimatePresence>
            {isGoal && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">
                      Target value
                    </label>
                    <input
                      value={goalTarget}
                      onChange={e => setGoalTarget(e.target.value)}
                      type="number"
                      placeholder={unit === "%" ? "E.g. 80" : "E.g. 100"}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">
                      Direction
                    </label>
                    <select
                      value={goalDir}
                      onChange={e => setGoalDir(e.target.value as GoalDir)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                    >
                      <option value="above">Above target (higher = better)</option>
                      <option value="below">Below target (lower = better)</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors">Cancel</button>
          <button
            disabled={!canSave}
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Save metric
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<CustomMetric[]>(() => loadMetrics());
  const [vars, setVars]       = useState<VarMap>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  // Persist on change
  useEffect(() => { saveMetrics(metrics); }, [metrics]);

  // Fetch live variable values from funnel-health
  const fetchVars = () => {
    setLoading(true);
    fetch("/api/funnel-health")
      .then(r => r.json())
      .then(data => {
        const nu = data.new_users   ?? [];
        const ou = data.old_users   ?? [];
        const s  = data.summary     ?? {};

        // Helper: find count for a funnel step key
        const step = (arr: {key:string;count:number}[], key: string) =>
          arr.find(x => x.key === key)?.count ?? 0;

        setVars({
          new_users:            s.new_user_count   ?? 0,
          returning_users:      s.old_user_count   ?? 0,
          anonymous_users:      s.anonymous_count  ?? 0,
          total_devices:        s.total_devices    ?? 0,
          got_into_app:         step(nu, "in_app"),
          completed_onboarding: step(nu, "onboarding"),
          used_watchlist:       step(nu, "core"),
          reached_payment:      step(nu, "payment"),
          ret_onboarding:       step(ou, "onboarding"),
          ret_watchlist:        step(ou, "core"),
          ret_payment:          step(ou, "payment"),
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchVars(); }, []);

  const addMetric = (m: Omit<CustomMetric, "id" | "createdAt">) => {
    const newM: CustomMetric = {
      ...m,
      id: `m-${Date.now()}`,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    setMetrics(prev => [...prev, newM]);
    setShowNew(false);
  };

  const deleteMetric = (id: string) => setMetrics(prev => prev.filter(m => m.id !== id));

  const toggleGoal = (id: string) =>
    setMetrics(prev => prev.map(m => m.id === id ? { ...m, isGoal: !m.isGoal } : m));

  const goalMetrics  = metrics.filter(m => m.isGoal);
  const otherMetrics = metrics.filter(m => !m.isGoal);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Metrics</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Formula-based · Computed from live data</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchVars}
              title="Refresh data"
              className={`w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors ${loading ? "animate-spin" : ""}`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New metric
            </button>
          </div>
        </div>

        {/* Variables reference */}
        <VarsPanel vars={vars} />

        {/* Goal metrics */}
        {goalMetrics.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Goal metrics</p>
              <Star className="w-3 h-3 text-amber-500 fill-current" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {goalMetrics.map(m => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}>
                    <GoalMetricCard
                      metric={m}
                      value={loading ? null : evalFormula(m.formula, vars)}
                      onToggleGoal={() => toggleGoal(m.id)}
                      onDelete={() => deleteMetric(m.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Other metrics */}
        {otherMetrics.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">All metrics</p>
            <div className="space-y-2">
              <AnimatePresence>
                {otherMetrics.map(m => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}>
                    <MetricRow
                      metric={m}
                      value={loading ? null : evalFormula(m.formula, vars)}
                      onToggleGoal={() => toggleGoal(m.id)}
                      onDelete={() => deleteMetric(m.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Empty */}
        {metrics.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
            <TargetIcon className="w-8 h-8 text-zinc-700 mb-3" />
            <p className="text-zinc-400 text-sm font-medium mb-1">No metrics defined</p>
            <p className="text-zinc-600 text-xs max-w-xs leading-relaxed mb-4">
              Define a metric using a formula and the available variables. Set it as a goal to track progress.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3.5 py-2 rounded-lg transition-colors border border-zinc-700"
            >
              <Plus className="w-3.5 h-3.5" />
              New metric
            </button>
          </div>
        )}

      </div>

      <AnimatePresence>
        {showNew && (
          <NewMetricModal vars={vars} onCreate={addMetric} onClose={() => setShowNew(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
