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
  const dayStart = `${latestDate}T00:00:00`;
  const dayEnd   = `${latestDate}T23:59:59`;

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
        .lte("occurred_at", dayEnd)
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

  // ── Avg session duration ────────────────────────────────────────────────────
  const userTimes: Record<string, { min: number; max: number }> = {};
  for (const e of evs) {
    const t = new Date(e.occurred_at).getTime();
    if (!userTimes[e.device_id]) {
      userTimes[e.device_id] = { min: t, max: t };
    }
    if (t < userTimes[e.device_id].min) userTimes[e.device_id].min = t;
    if (t > userTimes[e.device_id].max) userTimes[e.device_id].max = t;
  }

  const sessionSpans = Object.values(userTimes)
    .map((u) => (u.max - u.min) / 1000 / 60)
    .filter((mins) => mins > 0);

  const avgSessionMinutes =
    sessionSpans.length > 0
      ? parseFloat((sessionSpans.reduce((a, b) => a + b, 0) / sessionSpans.length).toFixed(1))
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

  // ── Top users by event count ────────────────────────────────────────────────
  const userEventCount: Record<string, number> = {};
  for (const e of evs) {
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

  return Response.json({
    date:                latestDate,
    avg_session_minutes: avgSessionMinutes,
    avg_prompt_seconds:  avgPromptSeconds,
    dau,
    top_users,
    category_breakdown,
    total_events: evs.length,
  });
}
