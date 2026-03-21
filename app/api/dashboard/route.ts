import { supabaseAdmin } from "@/lib/supabase";

// GET /api/dashboard
// Computes 4 headline metrics + daily history directly from raw_events.

const REGISTRATION = [
  "user_registered", "Register Button Clicked",
  "google_signup_button_clicked_register_page",
  "submit_button_clicked_register_page", "register_page_otp_sent",
];

const PAYMENT = [
  "payment_modal_modal_viewed", "payment_modal_plan_viewed",
  "payment_modal_payment_button_clicked", "payment_modal_trial_button_clicked",
  "payment_modal_checkout_completed", "ai_onboarding_modal_billing_screen_shown",
  "post_onboarding_modal_billing_screen_shown",
];

const IN_APP = [
  "viewed_dashboard_page", "extension_page_viewed", "extension_page_extension_installed",
  "ai_onboarding_modal_listen_screen_viewed", "ai_onboarding_modal_start_listening_clicked",
  "ai_onboarding_modal_suggestion_card_clicked", "ai_onboarding_modal_extension_screen_viewed",
  "post_onboarding_modal_tour_modal_opened", "post_onboarding_modal_card_selected",
  "viewed_watchlist_details_page", "viewed_reddit_watchlist_details_page",
  "viewed_lists_page", "prompt_flow_completed", "prompt_loading_modal_shown",
  "filter_label_used", "filter_show_interactions_used", "filter_posted_date_used",
  "watchlist_sidebar_clicked", ...PAYMENT,
];

const IN_APP_SET       = new Set(IN_APP);
const REGISTRATION_SET = new Set(REGISTRATION);
const PAYMENT_SET      = new Set(PAYMENT);

export async function GET() {
  const db = supabaseAdmin();

  const { data: rawEvs, error } = await db
    .from("raw_events")
    .select("distinct_id, event_name, occurred_at, properties");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const evs = rawEvs ?? [];

  // ── Parse: resolve device_id from properties["Device ID"] ────────────────

  type Ev = { device_id: string; event_name: string; date: string };
  const parsed: Ev[] = evs.map((e) => {
    const p: Record<string, string> = e.properties
      ? typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties
      : {};
    const device_id = e.distinct_id.startsWith("$device:")
      ? (p["Device ID"] || e.distinct_id).trim()
      : e.distinct_id;
    return {
      device_id,
      event_name: e.event_name,
      date:       e.occurred_at.slice(0, 10),
    };
  });

  // ── Date range ────────────────────────────────────────────────────────────

  const allDates = [...new Set(parsed.map((e) => e.date))].sort();
  const windowStart   = allDates[0]  ?? new Date().toISOString().slice(0, 10);
  const windowEnd     = allDates[allDates.length - 1] ?? windowStart;
  const windowStartMs = new Date(windowStart).getTime();
  const currentDay    = Math.floor((new Date(windowEnd).getTime() - windowStartMs) / 86_400_000) + 1;

  const dateRange: string[] = [];
  const cur = new Date(windowStart);
  while (cur.toISOString().slice(0, 10) <= windowEnd) {
    dateRange.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // ── Per-day bucketing ─────────────────────────────────────────────────────

  const dayInApp: Record<string, Set<string>> = {};
  const dayReg:   Record<string, Set<string>> = {};
  const dayPaid:  Record<string, Set<string>> = {};
  const deviceFirstDate: Record<string, string> = {};

  for (const e of parsed) {
    if (IN_APP_SET.has(e.event_name) || REGISTRATION_SET.has(e.event_name)) {
      (dayInApp[e.date] ??= new Set()).add(e.device_id);
    }
    if (REGISTRATION_SET.has(e.event_name)) (dayReg[e.date]  ??= new Set()).add(e.device_id);
    if (PAYMENT_SET.has(e.event_name))      (dayPaid[e.date] ??= new Set()).add(e.device_id);
    if (!deviceFirstDate[e.device_id] || e.date < deviceFirstDate[e.device_id]) {
      deviceFirstDate[e.device_id] = e.date;
    }
  }

  // ── DAU: distinct active devices per day ──────────────────────────────────

  const dauHistory = dateRange.map((date) => ({ date, value: dayInApp[date]?.size ?? 0 }));
  const dauLatest  = dauHistory[dauHistory.length - 1];

  // ── WAU: rolling 7-day unique devices ────────────────────────────────────

  const wauHistory = dateRange.map((date, i) => {
    const devs = new Set<string>();
    for (const d of dateRange.slice(Math.max(0, i - 6), i + 1)) {
      for (const dev of (dayInApp[d] ?? [])) devs.add(dev);
    }
    return { date, value: devs.size };
  });
  const wauLatest = wauHistory[wauHistory.length - 1];

  // ── Paid conversion: cumulative % of registrants who hit a payment event ──

  const cumReg  = new Set<string>();
  const cumPaid = new Set<string>();
  const paidConvHistory = dateRange.map((date) => {
    for (const d of (dayReg[date]  ?? [])) cumReg.add(d);
    for (const d of (dayPaid[date] ?? [])) cumPaid.add(d);
    return { date, value: cumReg.size > 0 ? cumPaid.size / cumReg.size : 0 };
  });
  const paidLatest = paidConvHistory[paidConvHistory.length - 1];

  // ── D28 retention: week-1 cohort still active on day 28+ ─────────────────

  const d28Available = currentDay >= 28;
  const week1Devices = new Set(
    Object.entries(deviceFirstDate)
      .filter(([, fd]) => (new Date(fd).getTime() - windowStartMs) / 86_400_000 < 7)
      .map(([did]) => did)
  );

  const d28History = dateRange.map((date, i) => {
    if (i < 27) return { date, value: null as number | null };
    const recent = new Set<string>();
    for (const d of dateRange.slice(i - 6, i + 1)) {
      for (const dev of (dayInApp[d] ?? [])) recent.add(dev);
    }
    const retained = [...week1Devices].filter((d) => recent.has(d)).length;
    return { date, value: week1Devices.size > 0 ? retained / week1Devices.size : 0 };
  });

  const lastD28 = [...d28History].reverse().find((d) => d.value !== null);
  const d28Latest = lastD28
    ? { value: lastD28.value!, user_count: Math.round(lastD28.value! * week1Devices.size), computed_on: lastD28.date }
    : null;

  return Response.json({
    window: { current_day: currentDay, window_start: windowStart },
    metrics: {
      dau: {
        label: "DAU", description: "Users who opened OutX today",
        latest:  { value: dauLatest.value,   user_count: dauLatest.value,  computed_on: dauLatest.date },
        history: dauHistory, available: true,
      },
      d7_retention: {
        label: "WAU / D7", description: "Users active in the last 7 days",
        latest:  { value: wauLatest.value,   user_count: wauLatest.value,  computed_on: wauLatest.date },
        history: wauHistory, available: true,
      },
      d28_retention: {
        label: "D28 Retention",
        description: d28Available ? "28-day retention rate" : `Available after day 28 (day ${currentDay} now)`,
        latest: d28Latest, history: d28Available ? d28History : [], available: d28Available,
      },
      paid_users: {
        label: "Paid Conversion", description: "Trial-to-paid conversion rate",
        latest:  { value: paidLatest.value, user_count: cumPaid.size, computed_on: paidLatest.date },
        history: paidConvHistory, available: true,
      },
    },
  });
}
