import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/user-behaviour
// Reads from pre-computed user_snapshots table — instant instead of paginating
// through 47k raw_events rows.

const makePlan = (raw: string | null): string => {
  if (!raw || raw === "null" || raw === "") return "—";
  if (raw === "free") return "Free Trial";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const isPaid  = (plan: string) => ["paid", "premium", "pro", "business"].some((k) => plan.toLowerCase().includes(k));
const isTrial = (plan: string) => plan.toLowerCase().includes("trial") || plan.toLowerCase().includes("free");

export async function GET() {
  const db = supabaseAdmin();

  // Single query — only users with an email (same filter as previous route)
  const { data, error } = await db
    .from("user_snapshots")
    .select("*")
    .not("email", "is", null)
    .neq("email", "");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  type Snapshot = {
    distinct_id:     string;
    name:            string | null;
    email:           string | null;
    plan_type:       string | null;
    first_seen:      string | null;
    last_seen:       string | null;
    total_events:    number;
    churn_score:     number;
    risk_level:      string;
    funnel_stage:    string;
    user_type:       string;
    days_since_last: number;
    reached_signup:  boolean;
  };

  const snapshots = (data ?? []) as Snapshot[];

  // Map snapshots to the same row shape the frontend expects
  const rows = snapshots
    .map((s) => {
      const plan = makePlan(s.plan_type);
      return {
        device_id:       s.distinct_id,
        name:            s.name  && s.name  !== "null" ? s.name  : "—",
        email:           s.email && s.email !== "null" ? s.email : "—",
        user_type:       s.user_type || (s.reached_signup ? "new" : "old"),
        plan,
        churn_score:     s.churn_score,
        risk_level:      s.risk_level as "healthy" | "at-risk" | "critical",
        funnel_stage:    s.funnel_stage,
        last_seen:       s.last_seen  ?? "",
        first_seen:      s.first_seen ?? "",
        days_since_last: s.days_since_last,
        total_events:    s.total_events,
        distinct_ids:    [s.distinct_id],
      };
    })
    .sort((a, b) => b.churn_score - a.churn_score);

  // Summary — same shape as before
  const highRisk = rows.filter((r) => r.risk_level === "critical");
  const summary = {
    total_users:     rows.length,
    high_risk_count: highRisk.length,
    high_risk_paid:  highRisk.filter((r) => isPaid(r.plan)).length,
    high_risk_trial: highRisk.filter((r) => isTrial(r.plan)).length,
    at_risk_count:   rows.filter((r) => r.risk_level === "at-risk").length,
    healthy_count:   rows.filter((r) => r.risk_level === "healthy").length,
  };

  return Response.json({ summary, users: rows });
}
