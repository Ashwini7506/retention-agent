import { supabaseAdmin } from "@/lib/supabase";

// GET /api/user-behaviour
// Returns per-user churn scores + summary for the User Behaviour tab.

const REGISTRATION = ["user_registered", "Register Button Clicked", "google_signup_button_clicked_register_page", "submit_button_clicked_register_page", "register_page_otp_sent"];
const ONBOARDING   = ["ai_onboarding_modal_listen_screen_viewed", "ai_onboarding_modal_start_listening_clicked", "ai_onboarding_modal_suggestion_card_clicked", "ai_onboarding_modal_extension_screen_viewed", "post_onboarding_modal_tour_modal_opened", "post_onboarding_modal_card_selected"];
const CORE         = ["viewed_watchlist_details_page", "viewed_reddit_watchlist_details_page", "viewed_lists_page", "prompt_flow_completed", "prompt_loading_modal_shown", "filter_label_used", "filter_show_interactions_used", "filter_posted_date_used", "watchlist_sidebar_clicked"];
const PAYMENT      = ["payment_modal_modal_viewed", "payment_modal_plan_viewed", "payment_modal_payment_button_clicked", "payment_modal_trial_button_clicked", "payment_modal_checkout_completed", "ai_onboarding_modal_billing_screen_shown", "post_onboarding_modal_billing_screen_shown"];
const IN_APP       = ["viewed_dashboard_page", "extension_page_viewed", "extension_page_extension_installed", ...ONBOARDING, ...CORE, ...PAYMENT];

function funnelStage(events: Set<string>): string {
  if (PAYMENT.some((e) => events.has(e)))      return "Payment";
  if (CORE.some((e) => events.has(e)))         return "Watchlist / Prompts";
  if (ONBOARDING.some((e) => events.has(e)))   return "AI Onboarding";
  if (IN_APP.some((e) => events.has(e)))       return "Got Into App";
  if (REGISTRATION.some((e) => events.has(e))) return "Signed Up";
  return "Unknown";
}

function churnScore(opts: {
  stage: string;
  daysSinceLast: number;
  totalEvents: number;
  plan: string;
}): number {
  let s = 0;

  // Signal 1 — funnel stage (35 pts max; higher stage = lower risk)
  const stageW: Record<string, number> = {
    "Payment": 0, "Watchlist / Prompts": 10,
    "AI Onboarding": 20, "Got Into App": 28, "Signed Up": 35, "Unknown": 30,
  };
  s += stageW[opts.stage] ?? 30;

  // Signal 2 — recency (35 pts max)
  s += Math.min(opts.daysSinceLast * 9, 35);

  // Signal 3 — engagement depth (15 pts max)
  if (opts.totalEvents < 5)       s += 15;
  else if (opts.totalEvents < 15) s += 8;
  else if (opts.totalEvents < 30) s += 3;

  // Signal 4 — plan type (15 pts max)
  const p = opts.plan.toLowerCase();
  if (["paid", "premium", "pro", "business"].some((k) => p.includes(k))) s += 0;
  else if (p === "—" || p === "" || p === "unknown")                       s += 15;
  else                                                                      s += 10; // free/trial

  return Math.min(Math.round(s), 100);
}

function riskLevel(score: number): "healthy" | "at-risk" | "critical" {
  if (score >= 61) return "critical";
  if (score >= 31) return "at-risk";
  return "healthy";
}

const pick = (current: string, candidate: string | null | undefined): string => {
  if (current && current !== "null") return current;
  const c = (candidate ?? "").trim();
  return c && c !== "null" ? c : current;
};

const makePlan = (raw: string): string => {
  if (!raw || raw === "null" || raw === "") return "—";
  if (raw === "free") return "Free Trial";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export async function GET() {
  const db = supabaseAdmin();

  const [eventsRes, usersRes] = await Promise.all([
    db.from("raw_events").select("distinct_id, event_name, occurred_at, properties").limit(100000),
    db.from("users").select("distinct_id, name, email, plan_type, acquisition_source"),
  ]);

  if (eventsRes.error) {
    return Response.json({ error: eventsRes.error.message }, { status: 500 });
  }

  const evs = eventsRes.data ?? [];

  // Build user profile lookup
  const userProfile: Record<string, { name: string; email: string; plan_type: string }> = {};
  for (const u of usersRes.data ?? []) {
    userProfile[u.distinct_id] = {
      name:      u.name      ?? "",
      email:     u.email     ?? "",
      plan_type: u.plan_type ?? u.acquisition_source ?? "",
    };
  }

  // Find latest date in dataset — used as "now" for recency calculation
  let maxTs = 0;
  for (const e of evs) {
    const t = new Date(e.occurred_at).getTime();
    if (t > maxTs) maxTs = t;
  }
  const now = maxTs || Date.now();

  // Group events by device_id
  type DeviceAcc = {
    events:      Set<string>;
    distinct_ids: Set<string>;
    firstTs:     number;
    lastTs:      number;
    totalEvents: number;
    name:        string;
    email:       string;
    plan_type:   string;
  };

  const devices: Record<string, DeviceAcc> = {};

  for (const e of evs) {
    const p: Record<string, string> =
      e.properties
        ? typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties
        : {};

    // Identified users must be grouped by distinct_id (stable).
    // Device ID changes per browser session, splitting the same user across buckets.
    // Only use Device ID for anonymous ($device:) users to link pre-login events.
    const device_id = e.distinct_id.startsWith("$device:")
      ? (p["Device ID"] || e.distinct_id).trim()
      : e.distinct_id;
    const ts = new Date(e.occurred_at).getTime();

    if (!devices[device_id]) {
      devices[device_id] = {
        events: new Set(), distinct_ids: new Set(),
        firstTs: ts, lastTs: ts, totalEvents: 0,
        name: "", email: "", plan_type: "",
      };
    }

    const d = devices[device_id];
    d.events.add(e.event_name);
    d.distinct_ids.add(e.distinct_id);
    d.totalEvents++;
    if (ts < d.firstTs) d.firstTs = ts;
    if (ts > d.lastTs)  d.lastTs  = ts;

    const prof = userProfile[e.distinct_id];
    if (prof) {
      d.name      = pick(d.name,      prof.name);
      d.email     = pick(d.email,     prof.email);
      d.plan_type = pick(d.plan_type, prof.plan_type);
    }
  }

  // Build rows — only identified users (have name or email)
  const rows = Object.entries(devices)
    .filter(([, d]) => {
      const hasId = Array.from(d.distinct_ids).some((id) => !id.startsWith("$device:"));
      const hasInfo = (d.name && d.name !== "null") || (d.email && d.email !== "null");
      return hasId && hasInfo;
    })
    .map(([device_id, d]) => {
      const stage = funnelStage(d.events);
      const daysSinceLast = Math.floor((now - d.lastTs) / 86_400_000);
      const plan = makePlan(d.plan_type);
      const score = churnScore({ stage, daysSinceLast, totalEvents: d.totalEvents, plan });
      return {
        device_id,
        name:            d.name && d.name !== "null" ? d.name : "—",
        email:           d.email && d.email !== "null" ? d.email : "—",
        user_type: (
          d.events.has("user_registered") ||
          d.events.has("Register Button Clicked") ||
          d.events.has("google_signup_button_clicked_register_page") ||
          d.events.has("submit_button_clicked_register_page")
        ) ? "new" : "old",
        plan,
        churn_score:     score,
        risk_level:      riskLevel(score),
        funnel_stage:    stage,
        last_seen:       new Date(d.lastTs).toISOString().slice(0, 10),
        first_seen:      new Date(d.firstTs).toISOString().slice(0, 10),
        days_since_last: daysSinceLast,
        total_events:    d.totalEvents,
        distinct_ids:    Array.from(d.distinct_ids),
      };
    })
    .sort((a, b) => b.churn_score - a.churn_score);

  // Summary
  const highRisk = rows.filter((r) => r.risk_level === "critical");
  const isPaid = (plan: string) =>
    ["paid", "premium", "pro", "business"].some((k) => plan.toLowerCase().includes(k));
  const isTrial = (plan: string) =>
    plan.toLowerCase().includes("trial") || plan.toLowerCase().includes("free");

  const summary = {
    total_users:      rows.length,
    high_risk_count:  highRisk.length,
    high_risk_paid:   highRisk.filter((r) => isPaid(r.plan)).length,
    high_risk_trial:  highRisk.filter((r) => isTrial(r.plan)).length,
    at_risk_count:    rows.filter((r) => r.risk_level === "at-risk").length,
    healthy_count:    rows.filter((r) => r.risk_level === "healthy").length,
  };

  return Response.json({ summary, users: rows });
}
