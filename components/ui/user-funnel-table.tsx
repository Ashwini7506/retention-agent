"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, ChevronDown, ChevronRight, Mail, X, Sparkles, Send, CheckCircle2, Loader2 } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type RiskLevel = "healthy" | "at-risk" | "critical";

export interface UserRow {
  device_id:    string;
  name:         string;
  email:        string;
  location:     string;
  utm_source:   string;
  plan:         string;
  last_step:    string;
  churn_score:  number;
  risk_level:   RiskLevel;
  distinct_ids: string[];
}

interface UserFunnelTableProps {
  rows: UserRow[];
  tab:  "new_users" | "old_users";
}

/* ─── Risk config ────────────────────────────────────────────────────────── */

const RISK_CONFIG: Record<RiskLevel, { label: string; bar: string; badge: string; dot: string }> = {
  critical:  { label: "Critical", bar: "bg-rose-500",   badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",   dot: "bg-rose-500"   },
  "at-risk": { label: "At Risk",  bar: "bg-amber-400",  badge: "bg-amber-400/15 text-amber-400 border-amber-400/30", dot: "bg-amber-400"  },
  healthy:   { label: "Healthy",  bar: "bg-emerald-500",badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
};

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const cfg = RISK_CONFIG[risk];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score, risk }: { score: number; risk: RiskLevel }) {
  const cfg = RISK_CONFIG[risk];
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${
        risk === "critical" ? "text-rose-400" : risk === "at-risk" ? "text-amber-400" : "text-emerald-400"
      }`}>{score}</span>
    </div>
  );
}

/* ─── Last Step pill ─────────────────────────────────────────────────────── */

const STEP_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "Signed Up":             { bg: "bg-zinc-700/40",   text: "text-zinc-300",   dot: "bg-zinc-400"    },
  "Installed Extension":   { bg: "bg-blue-900/30",   text: "text-blue-300",   dot: "bg-blue-400"    },
  "Used Watchlist / Prompt":{ bg: "bg-indigo-900/30",text: "text-indigo-300", dot: "bg-indigo-400"  },
  "Reached Paywall":       { bg: "bg-emerald-900/30",text: "text-emerald-300",dot: "bg-emerald-400" },
  "Came Back":             { bg: "bg-zinc-700/40",   text: "text-zinc-300",   dot: "bg-zinc-400"    },
  "Opened Watchlist":      { bg: "bg-indigo-900/30", text: "text-indigo-300", dot: "bg-indigo-400"  },
  "Ran a Prompt":          { bg: "bg-violet-900/30", text: "text-violet-300", dot: "bg-violet-400"  },
  "Used Reddit Watchlist": { bg: "bg-orange-900/30", text: "text-orange-300", dot: "bg-orange-400"  },
  "Used Filters":          { bg: "bg-teal-900/30",   text: "text-teal-300",   dot: "bg-teal-400"    },
  "Viewed Lists":          { bg: "bg-blue-900/30",   text: "text-blue-300",   dot: "bg-blue-400"    },
  "Hit Paywall":           { bg: "bg-emerald-900/30",text: "text-emerald-300",dot: "bg-emerald-400" },
};

function StepPill({ step }: { step: string }) {
  const s = STEP_STYLE[step] ?? { bg: "bg-zinc-700/40", text: "text-zinc-400", dot: "bg-zinc-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {step}
    </span>
  );
}

/* ─── Journey Modal ──────────────────────────────────────────────────────── */

const READABLE: Record<string, string> = {
  viewed_watchlist_details_page:            "Opened Watchlist",
  viewed_reddit_watchlist_details_page:     "Opened Reddit Watchlist",
  viewed_lists_page:                        "Viewed Lists",
  viewed_watchlist_page:                    "Viewed Watchlist Home",
  viewed_dashboard_page:                    "Opened Dashboard",
  prompt_flow_completed:                    "Completed a Prompt",
  prompt_loading_modal_shown:               "Started a Prompt",
  filter_label_used:                        "Filtered by Label",
  filter_show_interactions_used:            "Filtered Interactions",
  filter_posted_date_used:                  "Filtered by Date",
  watchlist_sidebar_clicked:                "Used Sidebar",
  payment_modal_modal_viewed:               "Viewed Payment Screen",
  payment_modal_plan_viewed:                "Viewed Plan Options",
  payment_modal_payment_button_clicked:     "Clicked Pay",
  payment_modal_trial_button_clicked:       "Started Trial",
  payment_modal_checkout_completed:         "Completed Checkout",
  ai_onboarding_modal_billing_screen_shown: "Onboarding: Billing Screen",
  extension_page_viewed:                    "Viewed Extension Page",
  extension_page_extension_installed:       "Installed Extension",
  user_registered:                          "Registered",
  "Register Button Clicked":                "Clicked Register",
  user_logged_in:                           "Logged In",
};

const readable = (n: string) => READABLE[n] ?? n.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const CAT_COLORS: Record<string, { dot: string; label: string; line: string }> = {
  Payment:        { dot: "bg-emerald-500", label: "text-emerald-400", line: "border-emerald-900/40" },
  Activation:     { dot: "bg-indigo-500",  label: "text-indigo-400",  line: "border-indigo-900/40" },
  Onboarding:     { dot: "bg-violet-500",  label: "text-violet-400",  line: "border-violet-900/40" },
  Authentication: { dot: "bg-amber-500",   label: "text-amber-400",   line: "border-amber-900/40"  },
  Extension:      { dot: "bg-blue-500",    label: "text-blue-400",    line: "border-blue-900/40"   },
  Registration:   { dot: "bg-rose-500",    label: "text-rose-400",    line: "border-rose-900/40"   },
  "Page Views":   { dot: "bg-zinc-500",    label: "text-zinc-400",    line: "border-zinc-800"      },
  "Product Use":  { dot: "bg-teal-500",    label: "text-teal-400",    line: "border-teal-900/40"   },
  Other:          { dot: "bg-zinc-600",    label: "text-zinc-500",    line: "border-zinc-800"      },
};

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function JourneyModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [journey, setJourney] = useState<{ days: { date: string; events: { time: string; name: string; category: string }[] }[]; total_events: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = (user.distinct_ids ?? []).join(",");
    fetch(`/api/user-journey?device_id=${encodeURIComponent(user.device_id)}&distinct_ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((d) => { setJourney(Array.isArray(d?.days) ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user.device_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-white">{user.name}</p>
              <RiskBadge risk={user.risk_level} />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{user.email} · {user.plan}</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-3 border-b border-zinc-800/60 flex gap-6 shrink-0">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Last Step</p>
            <p className="text-xs text-zinc-300 mt-0.5">{user.last_step}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Churn Score</p>
            <p className={`text-xs font-bold mt-0.5 ${
              user.risk_level === "critical" ? "text-rose-400" : user.risk_level === "at-risk" ? "text-amber-400" : "text-emerald-400"
            }`}>{user.churn_score}/100</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Source</p>
            <p className="text-xs text-zinc-300 mt-0.5">{user.utm_source}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Location</p>
            <p className="text-xs text-zinc-300 mt-0.5">{user.location}</p>
          </div>
        </div>

        {/* Events */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && (!journey || journey.days.length === 0) && (
            <div className="flex items-center justify-center py-12">
              <p className="text-zinc-600 text-sm">No events found for this user.</p>
            </div>
          )}
          {!loading && journey?.days.map((day, di) => {
            const groups: Record<string, { time: string; name: string }[]> = {};
            for (const ev of day.events) {
              const cat = ev.category || "Other";
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push({ time: ev.time, name: ev.name });
            }
            return (
              <div key={day.date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${di === 0 ? "bg-indigo-400" : "bg-zinc-700"}`} />
                  <span className="text-xs font-semibold text-zinc-300">{formatFullDate(day.date)}</span>
                  <div className="flex-1 h-px bg-zinc-800/60" />
                  <span className="text-[10px] text-zinc-700">{day.events.length} events</span>
                </div>
                <div className="ml-4 space-y-3 mb-1">
                  {Object.entries(groups).map(([cat, evs]) => {
                    const cfg = CAT_COLORS[cat] ?? CAT_COLORS["Other"];
                    return (
                      <div key={cat} className={`border-l-2 pl-3 ${cfg.line}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.label}`}>{cat}</span>
                        </div>
                        <div className="space-y-0.5">
                          {evs.map((ev, ei) => (
                            <div key={ei} className="flex items-center gap-3 py-0.5 pl-1">
                              <span className="text-[10px] text-zinc-700 tabular-nums shrink-0 w-9">{ev.time}</span>
                              <span className="text-xs text-zinc-300">{readable(ev.name)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Email Modal ────────────────────────────────────────────────────────── */

function EmailModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr]         = useState("");

  async function generateWithAI() {
    setGenerating(true); setErr("");
    try {
      const res  = await fetch("/api/generate-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Generation failed");
      setSubject(data.subject); setBody(data.body);
    } catch (e) { setErr(String(e).replace("Error: ", "")); }
    finally { setGenerating(false); }
  }

  async function send() {
    setSending(true); setErr("");
    try {
      const res  = await fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: user.email, subject, body }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Send failed");
      setSent(true);
    } catch (e) { setErr(String(e).replace("Error: ", "")); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      <div className="pointer-events-auto bg-[#1f1f1f] rounded-xl shadow-2xl flex flex-col border border-zinc-700/60 overflow-hidden w-[560px] max-h-[600px]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-[#2a2a2a] px-4 py-2.5 shrink-0">
          <span className="text-sm font-medium text-zinc-200">New Message</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors rounded p-0.5 hover:bg-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        {sent ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-medium text-zinc-200">Message sent</p>
            <p className="text-xs text-zinc-500">to {user.email}</p>
            <button onClick={onClose} className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2">Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-center border-b border-zinc-700/60 px-4 py-2 shrink-0">
              <span className="text-xs text-zinc-500 w-10 shrink-0">To</span>
              <span className="text-sm text-zinc-200">{user.email}</span>
            </div>
            <div className="flex items-center border-b border-zinc-700/60 px-4 shrink-0">
              <span className="text-xs text-zinc-500 w-10 shrink-0">Sub</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
                className="flex-1 bg-transparent py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none" />
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Write your message to ${user.name}…`}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none leading-relaxed min-h-[280px]" />
            {err && <p className="px-4 pb-2 text-xs text-rose-400">{err}</p>}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-700/60 bg-[#2a2a2a] shrink-0">
              <button onClick={send} disabled={sending || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {sending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</> : <><Send className="h-3.5 w-3.5" /> Send</>}
              </button>
              <div className="w-px h-5 bg-zinc-700 mx-1" />
              <button onClick={generateWithAI} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-zinc-600 hover:border-indigo-500 hover:bg-indigo-950/40 text-zinc-400 hover:text-indigo-300 text-xs font-medium transition-all disabled:opacity-40">
                {generating ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</> : <><Sparkles className="h-3 w-3" /> Write with AI</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Table ─────────────────────────────────────────────────────────── */

type SortField = "name" | "email" | "plan" | "last_step" | "churn_score" | "risk_level";

export function UserFunnelTable({ rows, tab }: UserFunnelTableProps) {
  const [page, setPage]                 = useState(1);
  const [sortField, setSortField]       = useState<SortField | null>(null);
  const [sortOrder, setSortOrder]       = useState<"asc" | "desc">("asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showExport, setShowExport]     = useState(false);
  const [journeyUser, setJourneyUser]   = useState<UserRow | null>(null);
  const [emailUser, setEmailUser]       = useState<UserRow | null>(null);
  const [selected, setSelected]         = useState<string[]>([]);

  const PER_PAGE = 10;

  const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, "at-risk": 1, healthy: 2 };

  const sorted = useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      let av: string | number = a[sortField] ?? "";
      let bv: string | number = b[sortField] ?? "";
      if (sortField === "churn_score") { av = a.churn_score; bv = b.churn_score; }
      if (sortField === "risk_level")  { av = RISK_ORDER[a.risk_level]; bv = RISK_ORDER[b.risk_level]; }
      if (typeof av === "number") return sortOrder === "asc" ? av - (bv as number) : (bv as number) - av;
      return sortOrder === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sortField, sortOrder]);

  const paginated  = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(sorted.length / PER_PAGE);

  const handleSort = (f: SortField) => {
    setSortField((prev) => { if (prev === f) { setSortOrder((o) => o === "asc" ? "desc" : "asc"); return f; } setSortOrder("asc"); return f; });
    setShowSortMenu(false); setPage(1);
  };

  const toggleSelect = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () =>
    setSelected(selected.length === paginated.length ? [] : paginated.map((r) => r.device_id));

  const exportCSV = () => {
    const headers = ["Name","Email","Location","Source","Plan","Last Step","Churn Score","Risk"];
    const body = sorted.map((r) =>
      [r.name, r.email, r.location, r.utm_source, r.plan, r.last_step, r.churn_score, r.risk_level]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...body].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `funnel-users-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const closeJourney = useCallback(() => setJourneyUser(null), []);
  const closeEmail   = useCallback(() => setEmailUser(null),   []);

  const rowVariants = {
    hidden:  { opacity: 0, y: 8, filter: "blur(3px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 380, damping: 26 } },
  };

  if (rows.length === 0) return null;

  return (
    <div className="px-8 pb-10 mt-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">
            {tab === "new_users" ? "New Users" : "Returning Users"} — Individual Journeys
          </h2>
          <p className="text-[11px] text-zinc-600 mt-0.5">{rows.length} users</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="relative">
            <button onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-400 text-xs hover:bg-zinc-800 transition-colors">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 6L6 3L9 6M6 3V13M13 10L10 13L7 10M10 13V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sort
              {sortField && <span className="bg-indigo-600 text-white rounded px-1 text-[9px]">1</span>}
              <ChevronDown size={12} className="opacity-50" />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-20 py-1 text-xs">
                  {(["name","email","plan","last_step","churn_score","risk_level"] as SortField[]).map((f) => (
                    <button key={f} onClick={() => handleSort(f)}
                      className={`w-full px-3 py-2 text-left hover:bg-zinc-800 transition-colors ${sortField === f ? "text-indigo-300" : "text-zinc-400"}`}>
                      {f === "last_step" ? "Last Step" : f === "churn_score" ? "Churn Score" : f === "risk_level" ? "Risk Level" : f.charAt(0).toUpperCase() + f.slice(1)}
                      {sortField === f && <span className="ml-1 opacity-60">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Export */}
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-400 text-xs hover:bg-zinc-800 transition-colors">
              <Download size={13} /> Export <ChevronDown size={12} className="opacity-50" />
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 mt-1 w-28 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-20 py-1 text-xs">
                  <button onClick={() => { exportCSV(); setShowExport(false); }}
                    className="w-full px-3 py-2 text-left text-zinc-400 hover:bg-zinc-800 transition-colors">CSV</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr_1.5fr_auto] gap-4 px-4 py-2.5 border-b border-zinc-800">
          {["Name","Email","Plan","Risk","Last Step","Churn Score","Actions"].map((h) => (
            <span key={h} className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <AnimatePresence mode="wait">
          <motion.div key={`${tab}-page-${page}`}
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            className="divide-y divide-zinc-800/40">
            {paginated.map((row) => (
              <motion.div key={row.device_id} variants={rowVariants}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr_1.5fr_auto] gap-4 px-4 py-3 items-center hover:bg-zinc-800/30 transition-colors">
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-900/60 border border-indigo-800/50 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-indigo-300">
                      {row.name !== "—" ? row.name.split(" ").map((n) => n[0]).join("").slice(0,2).toUpperCase() : "?"}
                    </span>
                  </div>
                  <span className="text-sm text-zinc-200 font-medium truncate">{row.name}</span>
                </div>
                {/* Email */}
                <span className="text-xs text-indigo-400 truncate font-mono">{row.email}</span>
                {/* Plan */}
                <span className={`text-xs font-medium ${
                  row.plan === "Free Trial" ? "text-amber-400" : row.plan === "—" ? "text-zinc-700" : "text-emerald-400"
                }`}>{row.plan}</span>
                {/* Risk */}
                <RiskBadge risk={row.risk_level} />
                {/* Last Step */}
                <StepPill step={row.last_step} />
                {/* Churn Score */}
                <ScoreBar score={row.churn_score} risk={row.risk_level} />
                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setJourneyUser(row)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-medium transition-colors whitespace-nowrap">
                    Journey <ChevronRight className="h-3 w-3" />
                  </button>
                  {row.email !== "—" && (
                    <button onClick={() => setEmailUser(row)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-medium transition-colors whitespace-nowrap border border-indigo-900/50 hover:border-indigo-500">
                      <Mail className="h-3 w-3" /> Email
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {paginated.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-800/60">
            <span className="text-[11px] text-zinc-700">{rows.length} user{rows.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[11px] text-zinc-600">Page {page} of {totalPages} · {sorted.length} users</span>
          <div className="flex gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-400 text-xs hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-zinc-400 text-xs hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {journeyUser && <JourneyModal user={journeyUser} onClose={closeJourney} />}
      {emailUser   && <EmailModal   user={emailUser}   onClose={closeEmail}   />}
    </div>
  );
}
