"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CreditCard, Users, X, ChevronRight, Clock, Activity, Mail, Sparkles, Send, CheckCircle2, Loader2 } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type RiskLevel = "healthy" | "at-risk" | "critical";

type UserRow = {
  device_id:      string;
  name:           string;
  email:          string;
  user_type:      "new" | "old";
  plan:           string;
  churn_score:    number;
  risk_level:     RiskLevel;
  funnel_stage:   string;
  last_seen:      string;
  first_seen:     string;
  days_since_last: number;
  total_events:   number;
  distinct_ids:   string[];
};

type Summary = {
  total_users:     number;
  high_risk_count: number;
  high_risk_paid:  number;
  high_risk_trial: number;
  at_risk_count:   number;
  healthy_count:   number;
};

type JourneyDay = {
  date:   string;
  events: { time: string; name: string; category: string }[];
};

type JourneyData = {
  device_id:    string;
  days:         JourneyDay[];
  total_events: number;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const RISK_CONFIG: Record<RiskLevel, { label: string; bar: string; badge: string; dot: string }> = {
  critical: { label: "Critical",  bar: "bg-rose-500",   badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",   dot: "bg-rose-500"   },
  "at-risk": { label: "At Risk", bar: "bg-amber-400",   badge: "bg-amber-400/15 text-amber-400 border-amber-400/30", dot: "bg-amber-400"  },
  healthy:  { label: "Healthy",   bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
};


function ScoreBar({ score, risk }: { score: number; risk: RiskLevel }) {
  const cfg = RISK_CONFIG[risk];
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${
        risk === "critical" ? "text-rose-400" : risk === "at-risk" ? "text-amber-400" : "text-emerald-400"
      }`}>
        {score}
      </span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const cfg = RISK_CONFIG[risk];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/* ─── Email Compose Modal ────────────────────────────────────────────────── */

function EmailModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendError, setSendError] = useState("");
  const [aiError, setAiError] = useState("");
  const [minimized, setMinimized] = useState(false);

  async function generateWithAI() {
    setGenerating(true);
    setAiError("");
    try {
      const res = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Generation failed");
      setSubject(data.subject);
      setBody(data.body);
    } catch (e) {
      setAiError(String(e).replace("Error: ", ""));
    } finally {
      setGenerating(false);
    }
  }

  async function send() {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: user.email, subject, body }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Send failed");
      setSent(true);
    } catch (e) {
      setSendError(String(e).replace("Error: ", ""));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      {/* Gmail-style compose window — bottom-right */}
      <div
        className={`pointer-events-auto bg-[#1f1f1f] rounded-xl shadow-2xl flex flex-col border border-zinc-700/60 overflow-hidden transition-all duration-200 w-[560px] ${minimized ? "max-h-[44px]" : "max-h-[600px]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between bg-[#2a2a2a] px-4 py-2.5 shrink-0 cursor-pointer select-none"
          onClick={() => setMinimized((m) => !m)}
        >
          <span className="text-sm font-medium text-zinc-200">
            {minimized && subject ? subject : "New Message"}
          </span>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMinimized((m) => !m)}
              title={minimized ? "Expand" : "Minimize"}
              className="text-zinc-500 hover:text-zinc-200 transition-colors rounded p-0.5 hover:bg-zinc-700"
            >
              <span className="block w-3.5 h-0.5 bg-current mt-1.5" />
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors rounded p-0.5 hover:bg-zinc-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {sent ? (
          /* Sent confirmation */
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-medium text-zinc-200">Message sent</p>
            <p className="text-xs text-zinc-500">to {user.email}</p>
            <button onClick={onClose} className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
              Close
            </button>
          </div>
        ) : (
          <>
            {/* To */}
            <div className="flex items-center border-b border-zinc-700/60 px-4 py-2 shrink-0">
              <span className="text-xs text-zinc-500 w-10 shrink-0">To</span>
              <span className="text-sm text-zinc-200">{user.email}</span>
            </div>

            {/* Subject */}
            <div className="flex items-center border-b border-zinc-700/60 px-4 shrink-0">
              <span className="text-xs text-zinc-500 w-10 shrink-0">Sub</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              />
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Write your message to ${user.name}…`}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none leading-relaxed min-h-[280px]"
            />

            {/* Error messages */}
            {(sendError || aiError) && (
              <div className="px-4 pb-2">
                <p className="text-xs text-rose-400">{sendError || aiError}</p>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-700/60 bg-[#2a2a2a] shrink-0">
              {/* Send */}
              <button
                onClick={send}
                disabled={sending || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {sending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Send</>
                )}
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-zinc-700 mx-1" />

              {/* Generate with AI */}
              <button
                onClick={generateWithAI}
                disabled={generating}
                title="Generate email with AI based on user's journey"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-zinc-600 hover:border-indigo-500 hover:bg-indigo-950/40 text-zinc-400 hover:text-indigo-300 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="h-3 w-3" /> Write with AI</>
                )}
              </button>

              {generating && (
                <span className="text-[11px] text-zinc-600 ml-1">Analysing {user.name}&apos;s journey…</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Event name → human readable ───────────────────────────────────────── */

const READABLE: Record<string, string> = {
  viewed_watchlist_details_page:            "Opened Watchlist",
  viewed_reddit_watchlist_details_page:     "Opened Reddit Watchlist",
  viewed_lists_page:                        "Viewed Lists",
  viewed_watchlist_page:                    "Viewed Watchlist Home",
  viewed_dashboard_page:                    "Opened Dashboard",
  viewed_activity_page:                     "Viewed Activity",
  viewed_settings_page:                     "Opened Settings",
  viewed_billing_settings_page:             "Viewed Billing Settings",
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
  payment_modal_billing_cycle_changed:      "Changed Billing Cycle",
  ai_onboarding_modal_listen_screen_viewed: "Onboarding: Listen Screen",
  ai_onboarding_modal_start_listening_clicked: "Onboarding: Start Listening",
  ai_onboarding_modal_suggestion_card_clicked: "Onboarding: Picked Suggestion",
  ai_onboarding_modal_extension_screen_viewed: "Onboarding: Extension Screen",
  ai_onboarding_modal_billing_screen_shown: "Onboarding: Billing Screen",
  post_onboarding_modal_tour_modal_opened:  "Started Product Tour",
  post_onboarding_modal_card_selected:      "Selected Tour Option",
  post_onboarding_modal_billing_screen_shown: "Post-Onboarding: Billing",
  extension_page_viewed:                    "Viewed Extension Page",
  extension_page_extension_installed:       "Installed Extension",
  extension_page_button_clicked:            "Clicked Extension CTA",
  user_registered:                          "Registered",
  "Register Button Clicked":                "Clicked Register",
  register_page_otp_sent:                   "OTP Sent",
  submit_button_clicked_register_page:      "Submitted Registration",
  google_signup_button_clicked_register_page: "Signed Up with Google",
  user_logged_in:                           "Logged In",
  user_logged_out:                          "Logged Out",
  create_list_modal_opened:                 "Opened Create List",
  list_csv_exported:                        "Exported List as CSV",
  list_emails_fetched:                      "Fetched Emails",
};

const readable = (name: string) => READABLE[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const CAT_BRANCH_COLORS: Record<string, { dot: string; label: string; line: string }> = {
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

/* ─── Story builder ─────────────────────────────────────────────────────── */

function buildStory(user: UserRow, journey: JourneyData) {
  const allEvents = journey.days.flatMap((day) =>
    day.events.map((ev) => ({ date: day.date, name: ev.name }))
  );

  const find = (test: (n: string) => boolean) => allEvents.find((e) => test(e.name));

  const regEv     = find((n) => n.includes("Registered") || n.includes("Register Button"));
  const extEv     = find((n) => n.includes("Installed"));
  const watchEv   = find((n) => n.includes("Watchlist") || n.includes("Prompt"));
  const paywallEv = find((n) => n.includes("Payment") && n.includes("View"));
  const paidEv    = find((n) => n.includes("Checkout Completed") || n.includes("Trial Button"));

  const milestones: { date: string; text: string; color: string }[] = [];
  if (regEv)     milestones.push({ date: regEv.date,     text: "Signed up",                        color: "bg-indigo-500" });
  if (extEv)     milestones.push({ date: extEv.date,     text: "Installed Chrome extension",       color: "bg-blue-500"   });
  if (watchEv)   milestones.push({ date: watchEv.date,   text: "Used watchlist / prompts",         color: "bg-violet-500" });
  if (paywallEv) milestones.push({ date: paywallEv.date, text: "Reached paywall",                  color: "bg-amber-500"  });
  if (paidEv)    milestones.push({
    date: paidEv.date,
    text: paidEv.name.includes("Trial") ? "Started free trial" : "Completed payment",
    color: "bg-emerald-500",
  });

  milestones.sort((a, b) => a.date.localeCompare(b.date));

  if (user.last_seen) {
    milestones.push({
      date: user.last_seen,
      text: user.days_since_last === 0 ? "Active today" : `Last active — ${user.days_since_last}d ago`,
      color: user.days_since_last >= 3 ? "bg-rose-500" : "bg-zinc-500",
    });
  }

  const firstName  = user.name !== "—" ? user.name.split(" ")[0] : "This user";
  const signupDate = regEv ? formatDate(regEv.date) : (user.first_seen ? formatDate(user.first_seen) : "an unknown date");
  const activeDays = journey.days.length;

  let narrative = `${firstName} first appeared on ${signupDate}`;
  if (user.plan !== "—") narrative += ` on a ${user.plan} plan`;
  narrative += `. Active across ${activeDays} day${activeDays !== 1 ? "s" : ""} with ${user.total_events} events total. `;

  if (paidEv) {
    narrative += `Completed the full funnel and converted${paidEv.name.includes("Trial") ? " to a free trial" : " to a paid plan"}.`;
  } else if (paywallEv) {
    narrative += `Reached the paywall on ${formatDate(paywallEv.date)} but did not convert.`;
  } else if (watchEv) {
    narrative += `Engaged with the product — used watchlists and prompts — but never reached the paywall.`;
  } else if (extEv) {
    narrative += `Installed the extension but never set up a watchlist or ran a prompt.`;
  } else {
    narrative += `Never installed the Chrome extension.`;
  }

  if (user.days_since_last >= 5) {
    narrative += ` Silent for ${user.days_since_last} days — strong churn signal.`;
  } else if (user.days_since_last >= 3) {
    narrative += ` Inactive for ${user.days_since_last} days.`;
  } else if (user.days_since_last <= 1) {
    narrative += ` Last seen very recently.`;
  }

  return { narrative, milestones };
}

function StoryView({ user, journey }: { user: UserRow; journey: JourneyData }) {
  const { narrative, milestones } = buildStory(user, journey);
  return (
    <>
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <p className="text-sm text-zinc-300 leading-relaxed">{narrative}</p>
      </div>
      <div>
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Key Moments</p>
        <div className="space-y-3">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[11px] text-zinc-600 tabular-nums shrink-0 w-14 pt-0.5">
                {m.date ? formatDate(m.date) : "—"}
              </span>
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${m.color}`} />
              <span className="text-sm text-zinc-300">{m.text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Journey Modal ──────────────────────────────────────────────────────── */

function JourneyModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = (user.distinct_ids ?? []).join(",");
    fetch(`/api/user-journey?device_id=${encodeURIComponent(user.device_id)}&distinct_ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((d) => { setJourney(Array.isArray(d?.days) ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user.device_id]);

  // Funnel stages for the mini progress strip
  const STAGES = ["Signed Up", "Got Into App", "AI Onboarding", "Watchlist / Prompts", "Payment"];
  const stageIdx = STAGES.indexOf(user.funnel_stage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-white">{user.name}</p>
              <RiskBadge risk={user.risk_level} />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{user.email} · {user.plan}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors mt-0.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Funnel progress strip */}
        <div className="px-6 py-3 border-b border-zinc-800/60 shrink-0">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Funnel Progress</p>
          <div className="flex items-center gap-1">
            {STAGES.map((stage, i) => {
              const reached = i <= stageIdx;
              const isCurrent = i === stageIdx;
              return (
                <div key={stage} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className={`
                    flex-1 min-w-0 text-center px-1 py-1 rounded text-[10px] font-medium truncate transition-colors
                    ${isCurrent ? "bg-indigo-600 text-white" : reached ? "bg-zinc-800 text-zinc-300" : "bg-zinc-900 text-zinc-700"}
                  `}>
                    {stage}
                  </div>
                  {i < STAGES.length - 1 && (
                    <ChevronRight className={`h-3 w-3 shrink-0 ${reached ? "text-zinc-500" : "text-zinc-800"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats row */}
        <div className="px-6 py-3 border-b border-zinc-800/60 flex gap-6 shrink-0">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">First Seen</p>
            <p className="text-xs text-zinc-300 mt-0.5">{formatDate(user.first_seen)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Last Seen</p>
            <p className="text-xs text-zinc-300 mt-0.5">{formatDate(user.last_seen)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Days Silent</p>
            <p className={`text-xs mt-0.5 font-medium ${user.days_since_last >= 3 ? "text-rose-400" : "text-zinc-300"}`}>
              {user.days_since_last}d
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Total Events</p>
            <p className="text-xs text-zinc-300 mt-0.5">{user.total_events}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Churn Score</p>
            <p className={`text-xs font-bold mt-0.5 ${
              user.risk_level === "critical" ? "text-rose-400" : user.risk_level === "at-risk" ? "text-amber-400" : "text-emerald-400"
            }`}>{user.churn_score}/100</p>
          </div>
        </div>

        {/* Story */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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

          {!loading && journey && journey.days.length > 0 && (
            <StoryView user={user} journey={journey} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Summary Card ───────────────────────────────────────────────────────── */

function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* High risk block */}
      <div className="md:col-span-1 bg-rose-950/30 border border-rose-900/40 rounded-xl px-5 py-4 flex items-start gap-4">
        <div className="mt-0.5 p-2 bg-rose-500/10 rounded-lg shrink-0">
          <AlertTriangle className="h-5 w-5 text-rose-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{summary.high_risk_count}</p>
          <p className="text-xs text-zinc-400 mt-0.5">users at high churn risk</p>
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <CreditCard className="h-3 w-3 text-emerald-500" />
              {summary.high_risk_paid} paid
            </span>
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Clock className="h-3 w-3 text-amber-400" />
              {summary.high_risk_trial} trial
            </span>
          </div>
        </div>
      </div>

      {/* At-risk */}
      <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl px-5 py-4 flex items-start gap-4">
        <div className="mt-0.5 p-2 bg-amber-500/10 rounded-lg shrink-0">
          <Activity className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{summary.at_risk_count}</p>
          <p className="text-xs text-zinc-400 mt-0.5">users at moderate risk</p>
          <p className="text-[11px] text-zinc-600 mt-1">Score 31–60</p>
        </div>
      </div>

      {/* Healthy */}
      <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-5 py-4 flex items-start gap-4">
        <div className="mt-0.5 p-2 bg-emerald-500/10 rounded-lg shrink-0">
          <Users className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{summary.healthy_count}</p>
          <p className="text-xs text-zinc-400 mt-0.5">users engaged & healthy</p>
          <p className="text-[11px] text-zinc-600 mt-1">Score 0–30</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Table ──────────────────────────────────────────────────────────────── */

const STAGE_ORDER = ["Signed Up", "Got Into App", "AI Onboarding", "Watchlist / Prompts", "Payment"];

function FunnelStagePill({ stage }: { stage: string }) {
  const idx = STAGE_ORDER.indexOf(stage);
  const colors = [
    "bg-zinc-800 text-zinc-400",
    "bg-zinc-800 text-zinc-300",
    "bg-violet-900/40 text-violet-300",
    "bg-indigo-900/40 text-indigo-300",
    "bg-emerald-900/40 text-emerald-300",
  ];
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${colors[idx] ?? "bg-zinc-800 text-zinc-400"}`}>
      {stage}
    </span>
  );
}

function UsersTable({
  users,
  onViewJourney,
  onEmail,
}: {
  users: UserRow[];
  onViewJourney: (u: UserRow) => void;
  onEmail: (u: UserRow) => void;
}) {
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "new" | "old">("all");
  const [search, setSearch] = useState("");

  const filtered = users.filter((u) => {
    if (riskFilter !== "all" && u.risk_level !== riskFilter) return false;
    if (typeFilter !== "all" && u.user_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Table controls */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-wrap">
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
        />
        {/* User type filter */}
        <div className="flex gap-1 bg-zinc-800/60 rounded-lg p-0.5">
          {(["all", "new", "old"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                typeFilter === f ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f === "all" ? "All Users" : f === "new" ? "New" : "Returning"}
            </button>
          ))}
        </div>
        {/* Risk filter */}
        <div className="flex gap-1">
          {(["all", "critical", "at-risk", "healthy"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRiskFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                riskFilter === f
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {f === "all" ? "All Risk" : f === "critical" ? "Critical" : f === "at-risk" ? "At Risk" : "Healthy"}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr_auto] gap-4 px-4 py-2.5 border-b border-zinc-800/60">
        {["Name", "Email", "Plan", "Risk", "Churn Score", "Actions"].map((h) => (
          <span key={h} className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-800/40">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">No users match this filter.</div>
        )}
        {filtered.map((u) => (
          <div
            key={u.device_id}
            className="grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr_auto] gap-4 px-4 py-3 items-center hover:bg-zinc-800/30 transition-colors"
          >
            <span className="text-sm text-zinc-200 truncate font-medium">{u.name}</span>
            <span className="text-xs text-zinc-500 truncate">{u.email}</span>
            <span className="text-xs text-zinc-400">{u.plan}</span>
            <RiskBadge risk={u.risk_level} />
            <ScoreBar score={u.churn_score} risk={u.risk_level} />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onViewJourney(u)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
              >
                Journey
                <ChevronRight className="h-3 w-3" />
              </button>
              {u.email !== "—" && (
                <button
                  onClick={() => onEmail(u)}
                  title="Send re-engagement email"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-medium transition-colors whitespace-nowrap border border-indigo-900/50 hover:border-indigo-500"
                >
                  <Mail className="h-3 w-3" />
                  Email
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800/60">
          <span className="text-[11px] text-zinc-700">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function UserBehaviourPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [emailUser, setEmailUser] = useState<UserRow | null>(null);

  useEffect(() => {
    fetch("/api/user-behaviour")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setSummary(d.summary ?? null);
        setUsers(Array.isArray(d.users) ? d.users : []);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const closeJourney = useCallback(() => setSelectedUser(null), []);
  const closeEmail   = useCallback(() => setEmailUser(null),   []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 flex items-center justify-center">
        <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-5 py-4">
          <p className="text-red-400 text-sm">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">User Behaviour</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Churn risk scoring · Individual journey tracking</p>
        </div>

        {/* Summary cards */}
        {summary && <SummaryCard summary={summary} />}

        {/* Table */}
        <UsersTable users={users} onViewJourney={setSelectedUser} onEmail={setEmailUser} />

      </div>

      {/* Journey modal — keep backdrop for this one */}
      {selectedUser && (
        <JourneyModal user={selectedUser} onClose={closeJourney} />
      )}

      {/* Email compose modal */}
      {emailUser && (
        <EmailModal user={emailUser} onClose={closeEmail} />
      )}
    </div>
  );
}
