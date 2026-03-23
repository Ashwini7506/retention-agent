import { supabaseAdmin } from "@/lib/supabase";

// GET /api/activity-stats
// Returns:
//  - avg session duration per DAU (first→last event span per user, latest day)
//  - avg prompt_flow_completed duration (from duration_seconds in properties)
//  - event category breakdown (% of each category for DAU users today)
//  - top active users by event count (for avatar stack)
//  - DAU count

// Same in-app events as dashboard DAU so both numbers match
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

  // Find the most recent day with events
  const { data: latestDay } = await db
    .from("raw_events")
    .select("occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestDay) {
    return Response.json({
      avg_session_minutes: null,
      avg_prompt_seconds: null,
      dau: 0,
      top_users: [],
      category_breakdown: [],
    });
  }

  // Get all events on the most recent day
  const latestDate = latestDay.occurred_at.slice(0, 10); // "YYYY-MM-DD"
  const dayStart = `${latestDate}T00:00:00`;
  const dayEnd = `${latestDate}T23:59:59`;

  const { data: events, error } = await db
    .from("raw_events")
    .select("distinct_id, event_name, occurred_at, event_category, properties")
    .gte("occurred_at", dayStart)
    .lte("occurred_at", dayEnd);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rawEvs = events ?? [];

  // Resolve device_id: identified users group by distinct_id, anonymous by Device ID
  const evs = rawEvs.map((e) => {
    const p: Record<string, string> = e.properties
      ? typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties
      : {};
    const device_id = e.distinct_id.startsWith("$device:")
      ? (p["Device ID"] || e.distinct_id).trim()
      : e.distinct_id;
    return { ...e, device_id };
  });

  // DAU = distinct resolved device_ids with in-app events (matches dashboard DAU tile)
  const userSet = new Set(evs.filter((e) => IN_APP.has(e.event_name)).map((e) => e.device_id));
  const dau = userSet.size;

  // Avg session duration: for each user, span = max(occurred_at) - min(occurred_at)
  const userTimes: Record<string, { min: number; max: number; count: number }> = {};
  for (const e of evs) {
    const t = new Date(e.occurred_at).getTime();
    if (!userTimes[e.device_id]) {
      userTimes[e.device_id] = { min: t, max: t, count: 0 };
    }
    if (t < userTimes[e.device_id].min) userTimes[e.device_id].min = t;
    if (t > userTimes[e.device_id].max) userTimes[e.device_id].max = t;
    userTimes[e.device_id].count++;
  }

  const sessionSpans = Object.values(userTimes)
    .map((u) => (u.max - u.min) / 1000 / 60) // minutes
    .filter((mins) => mins > 0); // exclude single-event sessions

  const avgSessionMinutes =
    sessionSpans.length > 0
      ? parseFloat((sessionSpans.reduce((a, b) => a + b, 0) / sessionSpans.length).toFixed(1))
      : null;

  // Avg prompt_flow_completed duration from properties
  const promptEvents = evs.filter((e) => e.event_name === "prompt_flow_completed");
  const promptDurations: number[] = [];
  for (const e of promptEvents) {
    let sec: number | null = null;
    if (e.properties) {
      const props = typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties;
      if (props.duration_seconds) sec = Number(props.duration_seconds);
      else if (props.duration_ms) sec = Number(props.duration_ms) / 1000;
    }
    if (sec !== null && sec > 0) promptDurations.push(sec);
  }

  // If no prompt events on this day, query all-time
  let avgPromptSeconds: number | null = null;
  if (promptDurations.length > 0) {
    avgPromptSeconds = parseFloat(
      (promptDurations.reduce((a, b) => a + b, 0) / promptDurations.length).toFixed(0)
    );
  } else {
    // All-time prompt durations
    const { data: allPrompts } = await db
      .from("raw_events")
      .select("properties")
      .eq("event_name", "prompt_flow_completed")
      .limit(100000);
    for (const e of allPrompts ?? []) {
      const props = typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties;
      if (props?.duration_seconds) promptDurations.push(Number(props.duration_seconds));
      else if (props?.duration_ms) promptDurations.push(Number(props.duration_ms) / 1000);
    }
    if (promptDurations.length > 0) {
      avgPromptSeconds = parseFloat(
        (promptDurations.reduce((a, b) => a + b, 0) / promptDurations.length).toFixed(0)
      );
    }
  }

  // Category breakdown (% of events by category)
  const catCounts: Record<string, number> = {};
  for (const e of evs) {
    const cat = e.event_category ?? "Other";
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
  }
  const total = evs.length || 1;
  const CATEGORY_COLORS: Record<string, string> = {
    Extension: "bg-indigo-500",
    Activation: "bg-violet-500",
    Onboarding: "bg-blue-500",
    Payment: "bg-emerald-500",
    Authentication: "bg-amber-400",
    "Page Views": "bg-zinc-500",
    Other: "bg-zinc-700",
  };
  const category_breakdown = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      value: Math.round((count / total) * 100),
      color: CATEGORY_COLORS[label] ?? "bg-zinc-600",
    }));

  // Top active users by event count (for avatar stack)
  const userEventCount: Record<string, number> = {};
  for (const e of evs) {
    userEventCount[e.device_id] = (userEventCount[e.device_id] ?? 0) + 1;
  }
  const top_users = Object.entries(userEventCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([device_id, count]) => ({
      id: device_id,
      initials: device_id.slice(0, 2).toUpperCase(),
      event_count: count,
    }));

  return Response.json({
    date: latestDate,
    avg_session_minutes: avgSessionMinutes,
    avg_prompt_seconds: avgPromptSeconds,
    dau,
    top_users,
    category_breakdown,
    total_events: evs.length,
  });
}
