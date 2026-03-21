"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import {
  UserPlus, MonitorSmartphone, Sparkles, List, CreditCard,
  GripVertical, X, Plus, Copy, Trash2, Download, Zap, Star,
  Mail, BookOpen, ShieldCheck, ChevronDown, ChevronUp,
} from "lucide-react";

/* ─── Step types & catalog ───────────────────────────────────────────────── */

// iconKey is stored in localStorage; icon is resolved at runtime
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UserPlus, MonitorSmartphone, Sparkles, List, CreditCard,
  Download, Mail, BookOpen, Star, Zap, ShieldCheck,
};

type FunnelStep = {
  id: string;
  label: string;
  iconKey: string;                                      // serializable
  icon: React.ComponentType<{ className?: string }>;   // derived
  color: string;
  bg: string;
  border: string;
  ring: string;
};

// Serialisable forms — no function references
type StoredStep = Omit<FunnelStep, "icon">;
type StoredExp  = Omit<FunnelExp, "steps"> & { steps: StoredStep[] };
type StoredState = { mainSteps: StoredStep[]; exps: StoredExp[] };

function hydrateStep(s: StoredStep): FunnelStep {
  return { ...s, icon: ICON_MAP[s.iconKey] ?? Zap };
}
function hydrateExp(e: StoredExp): FunnelExp {
  return { ...e, steps: e.steps.map(hydrateStep) };
}
function dehydrateStep(s: FunnelStep): StoredStep {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { icon, ...rest } = s; return rest;
}
function dehydrateExp(e: FunnelExp): StoredExp {
  return { ...e, steps: e.steps.map(dehydrateStep) };
}

const STORAGE_KEY = "funnelmind_v2";

function loadState(): { mainSteps: FunnelStep[]; exps: FunnelExp[] } {
  if (typeof window === "undefined") return { mainSteps: BASE_STEPS, exps: INITIAL_EXPERIMENTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mainSteps: BASE_STEPS, exps: INITIAL_EXPERIMENTS };
    const stored: StoredState = JSON.parse(raw);
    return {
      mainSteps: stored.mainSteps.map(hydrateStep),
      exps: stored.exps.map(hydrateExp),
    };
  } catch {
    return { mainSteps: BASE_STEPS, exps: INITIAL_EXPERIMENTS };
  }
}

function saveState(mainSteps: FunnelStep[], exps: FunnelExp[]) {
  try {
    const stored: StoredState = { mainSteps: mainSteps.map(dehydrateStep), exps: exps.map(dehydrateExp) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* quota — ignore */ }
}

const BASE_STEPS: FunnelStep[] = [
  { id: "signup",     label: "Signed Up",          iconKey: "UserPlus",          icon: UserPlus,          color: "text-zinc-300",    bg: "bg-zinc-800/60",    border: "border-zinc-700",    ring: "ring-zinc-600"    },
  { id: "in_app",     label: "Got Into App",        iconKey: "MonitorSmartphone", icon: MonitorSmartphone, color: "text-blue-300",    bg: "bg-blue-950/60",    border: "border-blue-800",    ring: "ring-blue-700"    },
  { id: "onboarding", label: "AI Onboarding",       iconKey: "Sparkles",          icon: Sparkles,          color: "text-violet-300",  bg: "bg-violet-950/60",  border: "border-violet-800",  ring: "ring-violet-700"  },
  { id: "core",       label: "Watchlist / Prompts", iconKey: "List",              icon: List,              color: "text-indigo-300",  bg: "bg-indigo-950/60",  border: "border-indigo-800",  ring: "ring-indigo-700"  },
  { id: "payment",    label: "Payment",             iconKey: "CreditCard",        icon: CreditCard,        color: "text-emerald-300", bg: "bg-emerald-950/60", border: "border-emerald-800", ring: "ring-emerald-700" },
];

const NODE_CATALOG: Omit<FunnelStep, "id">[] = [
  { label: "Extension Install", iconKey: "Download",    icon: Download,    color: "text-sky-300",    bg: "bg-sky-950/60",    border: "border-sky-800",    ring: "ring-sky-700"    },
  { label: "Email Verify",      iconKey: "Mail",        icon: Mail,        color: "text-amber-300",  bg: "bg-amber-950/60",  border: "border-amber-800",  ring: "ring-amber-700"  },
  { label: "Feature Tour",      iconKey: "BookOpen",    icon: BookOpen,    color: "text-teal-300",   bg: "bg-teal-950/60",   border: "border-teal-800",   ring: "ring-teal-700"   },
  { label: "Social Proof",      iconKey: "Star",        icon: Star,        color: "text-yellow-300", bg: "bg-yellow-950/60", border: "border-yellow-800", ring: "ring-yellow-700" },
  { label: "Quick Win",         iconKey: "Zap",         icon: Zap,         color: "text-orange-300", bg: "bg-orange-950/60", border: "border-orange-800", ring: "ring-orange-700" },
  { label: "Trust & Safety",    iconKey: "ShieldCheck", icon: ShieldCheck, color: "text-lime-300",   bg: "bg-lime-950/60",   border: "border-lime-800",   ring: "ring-lime-700"   },
];

/* ─── Experiment type ────────────────────────────────────────────────────── */

// "live" only applies to the main canvas — experiments are running / completed / draft
type ExpStatus = "running" | "completed" | "draft";

type FunnelExp = {
  id: string;
  name: string;
  status: ExpStatus;
  goal: string;
  steps: FunnelStep[];
  startedAt: string;
  results?: { label: string; value: string; positive: boolean }[];
  verdict?: string;
};

function cloneSteps(steps: FunnelStep[]): FunnelStep[] {
  return steps.map(s => ({ ...s, id: `${s.id}-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
}

const INITIAL_EXPERIMENTS: FunnelExp[] = [
  {
    id: "exp-001",
    name: "Delay extension install",
    status: "running",
    goal: "Reduce step 2 drop-off by 10%",
    steps: [
      BASE_STEPS[0],
      { ...BASE_STEPS[2], id: "onb-1" },
      { ...BASE_STEPS[3], id: "core-1" },
      { ...BASE_STEPS[1], id: "app-1" },
      { ...BASE_STEPS[4], id: "pay-1" },
    ],
    startedAt: "Mar 15, 2026",
    results: [
      { label: "Step 2 drop-off", value: "−8.2%", positive: true  },
      { label: "D7 Retention",    value: "−2.1%", positive: false },
    ],
    verdict: "Goal metric trending positive but D7 retention showing early decline.",
  },
  {
    id: "exp-002",
    name: "Early paywall nudge",
    status: "completed",
    goal: "Increase payment conversion by 8%",
    steps: [
      BASE_STEPS[0],
      { ...BASE_STEPS[2], id: "onb-2" },
      { ...BASE_STEPS[4], id: "pay-2" },
      { ...BASE_STEPS[3], id: "core-2" },
    ],
    startedAt: "Feb 28, 2026",
    results: [
      { label: "Payment conversion", value: "+11.3%", positive: true  },
      { label: "Watchlist setup",    value: "−18.6%", positive: false },
      { label: "D7 Retention",       value: "−9.2%",  positive: false },
    ],
    verdict: "Goal achieved but watchlist setup and D7 retention collapsed. Do not ship.",
  },
];

const GOAL_OPTIONS = [
  "Reduce drop-off at step 2",
  "Increase payment conversion",
  "Improve D7 retention",
  "Improve AI Onboarding completion",
  "Increase watchlist setup rate",
  "Reduce time to first value",
  "Improve activation rate",
];

const STATUS_STYLE: Record<ExpStatus, string> = {
  running:   "bg-indigo-500/15 text-indigo-300  border-indigo-500/30",
  completed: "bg-zinc-800      text-zinc-400    border-zinc-700",
  draft:     "bg-amber-500/10  text-amber-400   border-amber-500/20",
};

/* ─── SVG connection ─────────────────────────────────────────────────────── */

function Connection({ fromX, toX, y }: { fromX: number; toX: number; y: number }) {
  const mx = (fromX + toX) / 2;
  return (
    <g>
      <path
        d={`M ${fromX} ${y} C ${mx} ${y}, ${mx} ${y}, ${toX} ${y}`}
        stroke="#3f3f46" strokeWidth="1.5" fill="none" strokeDasharray="4 3"
      />
      <circle cx={toX} cy={y} r="2.5" fill="#52525b" />
    </g>
  );
}

/* ─── Mini funnel canvas (inside each experiment) ────────────────────────── */

function FunnelCanvas({
  steps,
  onReorder,
  onDragEnd,
  onAddNode,
  onDeleteNode,
}: {
  steps: FunnelStep[];
  onReorder: (s: FunnelStep[]) => void;
  onDragEnd: () => void;
  onAddNode: () => void;
  onDeleteNode: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs     = useRef<(HTMLDivElement | null)[]>([]);
  const [conns, setConns] = useState<{ fromX: number; toX: number; y: number }[]>([]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    const next: typeof conns = [];
    for (let i = 0; i < nodeRefs.current.length - 1; i++) {
      const a = nodeRefs.current[i];
      const b = nodeRefs.current[i + 1];
      if (!a || !b) continue;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      next.push({ fromX: ar.right - cr.left, toX: br.left - cr.left, y: ar.top - cr.top + ar.height / 2 });
    }
    setConns(next);
  }, [steps]);

  return (
    <div ref={containerRef} className="relative">
      <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        {conns.map((c, i) => <Connection key={i} {...c} />)}
      </svg>

      <Reorder.Group
        axis="x" values={steps} onReorder={onReorder}
        className="flex items-center gap-8 py-2"
        style={{ listStyle: "none", padding: 0, margin: 0 }}
      >
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <Reorder.Item
              key={step.id} value={step} onDragEnd={onDragEnd}
              className="cursor-grab active:cursor-grabbing group" style={{ listStyle: "none" }}
              whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
            >
              <div
                ref={el => { nodeRefs.current[i] = el; }}
                className={`relative w-36 rounded-xl border ${step.border} ${step.bg} px-3 py-3.5 select-none shadow-md hover:ring-1 ${step.ring} transition-all duration-150`}
              >
                <span className="absolute -top-2 -left-1.5 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[8px] font-bold text-zinc-500 font-mono">
                  {i + 1}
                </span>
                {/* Delete node button — appears on hover */}
                {steps.length > 1 && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onDeleteNode(step.id); }}
                    className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 hover:border-rose-500/50 transition-all z-10"
                  >
                    <X className="w-2 h-2 text-zinc-400 hover:text-rose-400" />
                  </button>
                )}
                <div className="absolute top-1.5 right-1.5 opacity-20 group-hover:opacity-0 transition-opacity">
                  <GripVertical className="w-3 h-3 text-zinc-400" />
                </div>
                <div className={`w-7 h-7 rounded-lg ${step.bg} border ${step.border} flex items-center justify-center mb-2.5`}>
                  <Icon className={`w-3.5 h-3.5 ${step.color}`} />
                </div>
                <p className={`text-[11px] font-semibold leading-snug ${step.color}`}>{step.label}</p>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <div className="flex items-center justify-between mt-3.5">
        <p className="text-[10px] text-zinc-600 flex items-center gap-1">
          <GripVertical className="w-2.5 h-2.5" />
          Drag to reorder
        </p>
        <button
          onClick={onAddNode}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md px-2 py-1 transition-colors"
        >
          <Plus className="w-2.5 h-2.5" />
          Add node
        </button>
      </div>
    </div>
  );
}

/* ─── Add Node Modal ─────────────────────────────────────────────────────── */

function AddNodeModal({ onAdd, onClose }: { onAdd: (n: Omit<FunnelStep, "id">) => void; onClose: () => void }) {
  const [sel, setSel]   = useState<number | null>(null);
  const [custom, setCustom] = useState("");

  const canAdd = sel !== null || custom.trim().length > 0;

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
        className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <p className="text-sm font-semibold text-zinc-100">Add funnel step</p>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded-md hover:bg-zinc-800 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Presets</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {NODE_CATALOG.map((n, i) => {
              const Icon = n.icon;
              return (
                <button
                  key={i} onClick={() => { setSel(sel === i ? null : i); setCustom(""); }}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${sel === i ? `${n.bg} ${n.border} ring-1 ${n.ring}` : "bg-zinc-800/40 border-zinc-700 hover:border-zinc-600"}`}
                >
                  <div className={`w-7 h-7 rounded-lg ${n.bg} border ${n.border} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${n.color}`} />
                  </div>
                  <span className="text-[10px] text-zinc-300 leading-tight">{n.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Custom</p>
          <input
            value={custom}
            onChange={e => { setCustom(e.target.value); setSel(null); }}
            placeholder="Step name..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors">Cancel</button>
          <button
            disabled={!canAdd}
            onClick={() => {
              if (sel !== null) onAdd(NODE_CATALOG[sel]);
              else onAdd({ label: custom.trim(), iconKey: "Zap", icon: Zap, color: "text-zinc-300", bg: "bg-zinc-800/60", border: "border-zinc-700", ring: "ring-zinc-600" });
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            Add to funnel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Single experiment block ────────────────────────────────────────────── */

function ExperimentBlock({
  exp,
  onUpdate,
  onDelete,
  onDuplicate,
  onMakeLive,
}: {
  exp: FunnelExp;
  onUpdate: (id: string, patch: Partial<FunnelExp>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMakeLive: (id: string) => void;
}) {
  // dragging state is purely ephemeral — source of truth is exp.steps (persisted)
  const [dragSteps, setDragSteps]     = useState(exp.steps);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal]         = useState(exp.name);

  // Keep dragSteps in sync if parent updates exp (e.g. after load from localStorage)
  useEffect(() => { setDragSteps(exp.steps); }, [exp.steps]);

  const handleDragEnd = () => {
    const changed = dragSteps.some((s, i) => s.id !== exp.steps[i]?.id);
    if (changed) onUpdate(exp.id, { steps: dragSteps });
  };

  const handleAddNode = (node: Omit<FunnelStep, "id">) => {
    const newStep: FunnelStep = { ...node, id: `${node.iconKey}-${Date.now()}` };
    const updated = [...dragSteps, newStep];
    onUpdate(exp.id, { steps: updated });
    setShowAddNode(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    const updated = dragSteps.filter(s => s.id !== nodeId);
    onUpdate(exp.id, { steps: updated });
  };

  const saveName = () => {
    setEditingName(false);
    if (nameVal.trim()) onUpdate(exp.id, { name: nameVal.trim() });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Name */}
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameVal(exp.name); } }}
              className="bg-zinc-800 border border-indigo-500 rounded-md px-2 py-0.5 text-sm font-semibold text-zinc-100 focus:outline-none w-48"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-semibold text-zinc-100 truncate hover:text-indigo-300 transition-colors cursor-text"
            >
              {exp.name}
            </button>
          )}

          {/* Status dropdown — running / completed / draft only */}
          <select
            value={exp.status}
            onChange={e => onUpdate(exp.id, { status: e.target.value as ExpStatus })}
            className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border appearance-none cursor-pointer bg-transparent focus:outline-none ${STATUS_STYLE[exp.status]}`}
          >
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="draft">draft</option>
          </select>

          {/* Goal */}
          <span className="hidden sm:block text-[11px] text-zinc-600 truncate">
            Goal: <span className="text-zinc-400">{exp.goal}</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {exp.results && exp.results.length > 0 && (
            <button
              onClick={() => setShowResults(v => !v)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors"
            >
              Results
              {showResults ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {/* Make Live — promotes this experiment's funnel to the main canvas */}
          <button
            onClick={() => onMakeLive(exp.id)}
            title="Make this the live funnel"
            className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md px-2 py-1 transition-colors"
          >
            Make live
          </button>
          <button
            onClick={() => onDuplicate(exp.id)}
            title="Duplicate"
            className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-300 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(exp.id)}
            title="Delete"
            className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="px-5 py-5 overflow-x-auto"
        style={{
          backgroundImage: "radial-gradient(circle, #27272a 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <FunnelCanvas
          steps={dragSteps}
          onReorder={s => setDragSteps(s)}
          onDragEnd={handleDragEnd}
          onAddNode={() => setShowAddNode(true)}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      {/* Results panel */}
      <AnimatePresence>
        {showResults && exp.results && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800"
          >
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {exp.results.map(r => (
                  <div key={r.label} className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] text-zinc-500 mb-1">{r.label}</p>
                    <p className={`text-sm font-mono font-semibold ${r.positive ? "text-emerald-400" : "text-rose-400"}`}>
                      {r.value}
                    </p>
                  </div>
                ))}
              </div>
              {exp.verdict && (
                <p className="text-[11px] text-zinc-500 bg-zinc-800/40 rounded-lg px-3 py-2.5 leading-relaxed border border-zinc-800">
                  <span className="text-zinc-600 font-semibold uppercase tracking-widest text-[9px] mr-2">AI Verdict</span>
                  {exp.verdict}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add node modal */}
      <AnimatePresence>
        {showAddNode && <AddNodeModal onAdd={handleAddNode} onClose={() => setShowAddNode(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ─── New experiment setup modal ─────────────────────────────────────────── */

function NewExpModal({
  baselineSteps,
  onCreate,
  onClose,
}: {
  baselineSteps: FunnelStep[];
  onCreate: (name: string, goal: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState(GOAL_OPTIONS[0]);

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
        className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <p className="text-sm font-semibold text-zinc-100">New experiment</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Starts as a copy of baseline</p>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded-md hover:bg-zinc-800 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Baseline preview */}
        <div className="px-5 pt-4 pb-3 bg-zinc-950/40 border-b border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Copying from baseline</p>
          <p className="text-[11px] text-zinc-400 font-mono leading-relaxed">
            {baselineSteps.map(s => s.label).join(" → ")}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">Experiment name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="E.g. Delay paywall, Skip onboarding..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">Goal</label>
            <select
              value={goal} onChange={e => setGoal(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {GOAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors">Cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => onCreate(name.trim(), goal)}
            className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            Create experiment
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main canvas (the live funnel — separate from experiments) ──────────── */

function MainFunnelCanvas({
  steps,
  onStepsChange,
}: {
  steps: FunnelStep[];
  onStepsChange: (s: FunnelStep[]) => void;
}) {
  const [dragSteps, setDragSteps] = useState(steps);
  const [showAddNode, setShowAddNode] = useState(false);

  useEffect(() => { setDragSteps(steps); }, [steps]);

  const handleDragEnd = () => {
    const changed = dragSteps.some((s, i) => s.id !== steps[i]?.id);
    if (changed) onStepsChange(dragSteps);
  };

  const handleAddNode = (node: Omit<FunnelStep, "id">) => {
    const updated = [...dragSteps, { ...node, id: `${node.iconKey}-${Date.now()}` }];
    onStepsChange(updated);
    setShowAddNode(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    onStepsChange(dragSteps.filter(s => s.id !== nodeId));
  };

  return (
    <>
      <div
        className="rounded-xl bg-zinc-950/40 border border-zinc-800 px-6 py-5 overflow-x-auto"
        style={{ backgroundImage: "radial-gradient(circle, #27272a 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      >
        <FunnelCanvas
          steps={dragSteps}
          onReorder={s => setDragSteps(s)}
          onDragEnd={handleDragEnd}
          onAddNode={() => setShowAddNode(true)}
          onDeleteNode={handleDeleteNode}
        />
      </div>
      <AnimatePresence>
        {showAddNode && <AddNodeModal onAdd={handleAddNode} onClose={() => setShowAddNode(false)} />}
      </AnimatePresence>
    </>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function ExperimentsPage() {
  const [mainSteps, setMainSteps] = useState<FunnelStep[]>(() => loadState().mainSteps);
  const [exps, setExps]           = useState<FunnelExp[]>(() => loadState().exps);
  const [showNew, setShowNew]     = useState(false);

  // Persist on every change
  useEffect(() => { saveState(mainSteps, exps); }, [mainSteps, exps]);

  const updateExp = (id: string, patch: Partial<FunnelExp>) =>
    setExps(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const deleteExp = (id: string) =>
    setExps(prev => prev.filter(e => e.id !== id));

  const duplicateExp = (id: string) => {
    const src = exps.find(e => e.id === id)!;
    setExps(prev => [...prev, {
      ...src,
      id: `exp-${Date.now()}`,
      name: `${src.name} (copy)`,
      status: "draft",
      startedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      steps: cloneSteps(src.steps),
      results: [],
      verdict: undefined,
    }]);
  };

  // "Make live" = copy this experiment's funnel steps to the main canvas
  const makeLive = (id: string) => {
    const src = exps.find(e => e.id === id)!;
    setMainSteps(cloneSteps(src.steps));
    updateExp(id, { status: "completed" });
  };

  const createNew = (name: string, goal: string) => {
    setExps(prev => [...prev, {
      id: `exp-${Date.now()}`,
      name,
      status: "running",
      goal,
      steps: cloneSteps(mainSteps),
      startedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }]);
    setShowNew(false);
  };

  const running   = exps.filter(e => e.status === "running");
  const completed = exps.filter(e => e.status === "completed");
  const drafts    = exps.filter(e => e.status === "draft");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Experiments</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {running.length} running · {completed.length} completed · {drafts.length} draft
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New experiment
          </button>
        </div>

        {/* Current live funnel */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Current Funnel</p>
            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-semibold text-emerald-400">Live</span>
            </div>
          </div>
          <MainFunnelCanvas steps={mainSteps} onStepsChange={setMainSteps} />
        </div>

        {/* Running */}
        {running.length > 0 && (
          <div className="mt-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">Running</p>
            <div className="space-y-3">
              <AnimatePresence>
                {running.map(exp => (
                  <motion.div key={exp.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                    <ExperimentBlock exp={exp} onUpdate={updateExp} onDelete={deleteExp} onDuplicate={duplicateExp} onMakeLive={makeLive} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="mt-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">Completed</p>
            <div className="space-y-3">
              {completed.map(exp => (
                <ExperimentBlock key={exp.id} exp={exp} onUpdate={updateExp} onDelete={deleteExp} onDuplicate={duplicateExp} onMakeLive={makeLive} />
              ))}
            </div>
          </div>
        )}

        {/* Drafts */}
        {drafts.length > 0 && (
          <div className="mt-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">Drafts</p>
            <div className="space-y-3">
              <AnimatePresence>
                {drafts.map(exp => (
                  <motion.div key={exp.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                    <ExperimentBlock exp={exp} onUpdate={updateExp} onDelete={deleteExp} onDuplicate={duplicateExp} onMakeLive={makeLive} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Empty */}
        {exps.length === 0 && (
          <div className="mt-4 flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
            <p className="text-zinc-400 text-sm font-medium mb-1">No experiments yet</p>
            <p className="text-zinc-600 text-xs max-w-xs leading-relaxed mb-4">
              Click &ldquo;New experiment&rdquo; to create a funnel variant and start testing.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3.5 py-2 rounded-lg transition-colors border border-zinc-700"
            >
              <Plus className="w-3.5 h-3.5" />
              New experiment
            </button>
          </div>
        )}

      </div>

      <AnimatePresence>
        {showNew && (
          <NewExpModal
            baselineSteps={mainSteps}
            onCreate={createNew}
            onClose={() => setShowNew(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
