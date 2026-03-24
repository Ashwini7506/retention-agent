import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/activity-stats
// Uses metrics_daily for headline numbers (instant) and keeps a small
// single-day raw_events query for session/prompt durations and category
// breakdown (only 1 day of events, ~1-2k rows — much faster than all 47k).

const IN_APP = new Set([
  "viewed_dashboard_page", "extension_page_viewed", "extension_page_extension_installed",
  "ai_onboarding_modal_listen_screen_viewed", "ai_onboarding_modal_start_listening_clicked",
  "ai_onboarding_modal_suggestion_card_clicked", "ai_onboarding_modal_extension_screen_viewed",
  "post_onboarding_modal_tour_modal_opened", "post_onboarding_modal_card_selected",
  "viewed_watchlist_details_page", "viewed_reddit_watchlist_details_page",
  "viewed_lists_page", "prompt_flow_completed", "prompt_loading_modal_shown",
  "filter_label_used", "filter_show_interactions_used", "filter_posted_date_used",
  "watchlist_sidebar_clicked",
  "payment_modal_modal_viewed", "payment_modal_plan_viewed",
  "payment_modal_payment_button_clicked", "payment_modal_trial_button_clicked",
  "payment_modal_checkout_completed", "ai_onboarding_modal_billing_screen_shown",
  "post_onboarding_modal_billing_screen_shown",
]);

const REGISTRATION = new Set([
  "user_registered",
  "Register Button Clicked",
  "google_signup_button_clicked_register_page",
  "submit_button_clicked_register_page",
  "register_page_otp_sent",
]);

// Session gap threshold: 30 minutes of inactivity = new session
const SESSION_GAP_MS = 30 * 60 * 1000;

/** Compute total session minutes for a user given sorted event timestamps.
 *  Groups consecutive events with < 30 min gap into one session.
 *  Sessions with only a single event contribute 0 duration.
 */
function computeSessionMinutes(sortedTs: number[]): number {
  if (sortedTs.length === 0) return 0;
  let totalMs = 0;
  let sessionStart = sortedTs[0];
  let prev = sortedTs[0];
  for (let i = 1; i < sortedTs.length; i++) {
    const gap = sortedTs[i] - prev;
    if (gap > SESSION_GAP_MS) {
      // session ended at prev
      totalMs += prev - sessionStart;
      sessionStart = sortedTs[i];
    }
    prev = sortedTs[i];
  }
  totalMs += prev - sessionStart;
  return parseFloat((totalMs / 1000 / 60).toFixed(1));
}

export async function GET() {
  const db = supabaseAdmin();

  // ── Get the most recent day from metrics_daily (instant) ───────────────────
  const { data: latest, error: e1 } = await db
    .from("metrics_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (e1 || !latest) {
    return Response.json({
      avg_session_minutes: null,
      avg_prompt_seconds:  null,
      dau:                 0,
      top_users:           [],
      category_breakdown:  [],
    });
  }

  const latestDate = latest.date as string; // "YYYY-MM-DD"
  const dau        = (latest as { dau: number }).dau;

  // ── Fetch only the latest day's raw events (small — 1-2k rows typically) ───
  // Explicit +00:00 so PostgreSQL treats boundaries as UTC, matching [:10] in snapshots.py
  const dayStart = `${latestDate}T00:00:00+00:00`;
  const nextDay  = new Date(latestDate + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dayEnd   = nextDay.toISOString().slice(0, 10) + "T00:00:00+00:00";

  const rawEvs: Array<{
    distinct_id:    string;
    event_name:     string;
    occurred_at:    string;
    event_category: string;
    properties:     unknown;
  }> = [];

  {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from("raw_events")
        .select("distinct_id, event_name, occurred_at, event_category, properties")
        .gte("occurred_at", dayStart)
        .lt("occurred_at", dayEnd)
        .range(offset, offset + PAGE - 1);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      if (!data || data.length === 0) break;
      rawEvs.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  // Resolve device_id
  const evs = rawEvs.map((e) => {
    const p: Record<string, string> = e.properties
      ? typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties as Record<string, string>
      : {};
    const device_id = e.distinct_id.startsWith("$device:")
      ? (p["Device ID"] || e.distinct_id).trim()
      : e.distinct_id;
    return { ...e, device_id };
  });

  // Only in-app + registration events count as DAU (mirrors snapshots.py definition)
  const dauEvs = evs.filter((e) => IN_APP.has(e.event_name) || REGISTRATION.has(e.event_name));

  // ── Avg session duration (session-gap approach) ─────────────────────────────
  // Collect sorted timestamps per DAU user from in-app events only
  const userTimestamps: Record<string, number[]> = {};
  for (const e of dauEvs) {
    const t = new Date(e.occurred_at).getTime();
    if (!userTimestamps[e.device_id]) userTimestamps[e.device_id] = [];
    userTimestamps[e.device_id].push(t);
  }
  for (const id of Object.keys(userTimestamps)) {
    userTimestamps[id].sort((a, b) => a - b);
  }

  const sessionMinsPerUser = Object.entries(userTimestamps)
    .map(([id, ts]) => ({ id, mins: computeSessionMinutes(ts) }));

  const nonZeroSessions = sessionMinsPerUser.filter((u) => u.mins > 0);
  const avgSessionMinutes =
    nonZeroSessions.length > 0
      ? parseFloat((nonZeroSessions.reduce((s, u) => s + u.mins, 0) / nonZeroSessions.length).toFixed(1))
      : null;

  // ── Avg prompt_flow_completed duration ─────────────────────────────────────
  const promptDurations: number[] = [];
  for (const e of evs.filter((e) => e.event_name === "prompt_flow_completed")) {
    const props = e.properties
      ? typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties as Record<string, unknown>
      : {};
    if ((props as Record<string, unknown>).duration_seconds) promptDurations.push(Number((props as Record<string, unknown>).duration_seconds));
    else if ((props as Record<string, unknown>).duration_ms) promptDurations.push(Number((props as Record<string, unknown>).duration_ms) / 1000);
  }

  // If no prompts today, query all-time (still fast — small table)
  let avgPromptSeconds: number | null = null;
  if (promptDurations.length > 0) {
    avgPromptSeconds = parseFloat(
      (promptDurations.reduce((a, b) => a + b, 0) / promptDurations.length).toFixed(0)
    );
  } else {
    const { data: allPrompts } = await db
      .from("raw_events")
      .select("properties")
      .eq("event_name", "prompt_flow_completed")
      .limit(100000);
    for (const e of allPrompts ?? []) {
      const props = typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties as Record<string, unknown>;
      if (props?.duration_seconds) promptDurations.push(Number(props.duration_seconds));
      else if (props?.duration_ms)  promptDurations.push(Number(props.duration_ms) / 1000);
    }
    if (promptDurations.length > 0) {
      avgPromptSeconds = parseFloat(
        (promptDurations.reduce((a, b) => a + b, 0) / promptDurations.length).toFixed(0)
      );
    }
  }

  // ── Category breakdown ──────────────────────────────────────────────────────
  const catCounts: Record<string, number> = {};
  for (const e of evs) {
    const cat = e.event_category ?? "Other";
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
  }
  const total = evs.length || 1;
  const CATEGORY_COLORS: Record<string, string> = {
    Extension:      "bg-indigo-500",
    Activation:     "bg-violet-500",
    Onboarding:     "bg-blue-500",
    Payment:        "bg-emerald-500",
    Authentication: "bg-amber-400",
    "Page Views":   "bg-zinc-500",
    Other:          "bg-zinc-700",
  };
  const category_breakdown = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      value: Math.round((count / total) * 100),
      color: CATEGORY_COLORS[label] ?? "bg-zinc-600",
    }));

  // ── Top users by in-app event count ────────────────────────────────────────
  const userEventCount: Record<string, number> = {};
  for (const e of dauEvs) {
    userEventCount[e.device_id] = (userEventCount[e.device_id] ?? 0) + 1;
  }
  const top_users = Object.entries(userEventCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([device_id, count]) => ({
      id:          device_id,
      initials:    device_id.slice(0, 2).toUpperCase(),
      event_count: count,
    }));

  // ── All DAU users with session time ────────────────────────────────────────
  const allDeviceIds = Object.keys(userEventCount);

  // Fetch name + email from user_snapshots for these device IDs
  const { data: snapRows } = await db
    .from("user_snapshots")
    .select("distinct_id, name, email")
    .in("distinct_id", allDeviceIds);

  const snapById: Record<string, { name: string | null; email: string | null }> = {};
  for (const row of snapRows ?? []) {
    snapById[row.distinct_id] = { name: row.name, email: row.email };
  }

  const sessionMinsById: Record<string, number> = {};
  for (const { id, mins } of sessionMinsPerUser) {
    sessionMinsById[id] = mins;
  }

  const dau_users = Object.entries(userEventCount)
    .sort(([, a], [, b]) => b - a)
    .map(([device_id, event_count]) => {
      const snap = snapById[device_id];
      return {
        device_id,
        name:            snap?.name  ?? null,
        email:           snap?.email ?? null,
        event_count,
        session_minutes: sessionMinsById[device_id] ?? 0,
      };
    });

  return Response.json({
    date:                latestDate,
    avg_session_minutes: avgSessionMinutes,
    avg_prompt_seconds:  avgPromptSeconds,
    dau,
    top_users,
    dau_users,
    category_breakdown,
    total_events: evs.length,
  });
}
