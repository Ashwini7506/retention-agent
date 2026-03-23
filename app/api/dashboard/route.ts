import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/dashboard
// Reads pre-computed metrics_daily rows — fast single query instead of
// paginating through 47k raw_events rows.

export async function GET() {
  const db = supabaseAdmin();

  // Single query — instant because metrics_daily has one row per date
  const { data, error } = await db
    .from("metrics_daily")
    .select("*")
    .order("date");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ error: "No snapshot data found. Run pipeline/compute/snapshots.py first." }, { status: 404 });
  }

  type DailyRow = {
    date: string;
    dau: number;
    new_signups: number;
    extension_installs: number;
    watchlist_prompt_users: number;
    paywall_reached: number;
    paid_conversions: number;
    total_events: number;
  };

  const rows: DailyRow[] = data as DailyRow[];

  // ── Date range ─────────────────────────────────────────────────────────────

  const windowStart   = rows[0].date;
  const windowEnd     = rows[rows.length - 1].date;
  const windowStartMs = new Date(windowStart).getTime();
  const currentDay    = Math.floor((new Date(windowEnd).getTime() - windowStartMs) / 86_400_000) + 1;

  // Build a complete date range (fill gaps with zeroes)
  const dateRange: string[] = [];
  const cur = new Date(windowStart);
  while (cur.toISOString().slice(0, 10) <= windowEnd) {
    dateRange.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Index rows by date for O(1) lookup
  const byDate: Record<string, DailyRow> = {};
  for (const r of rows) byDate[r.date] = r;

  const get = (date: string): DailyRow =>
    byDate[date] ?? {
      date,
      dau: 0,
      new_signups: 0,
      extension_installs: 0,
      watchlist_prompt_users: 0,
      paywall_reached: 0,
      paid_conversions: 0,
      total_events: 0,
    };

  // ── DAU history ────────────────────────────────────────────────────────────

  const dauHistory = dateRange.map((date) => ({ date, value: get(date).dau }));
  const dauLatest  = dauHistory[dauHistory.length - 1];

  // ── WAU: rolling 7-day sum of dau ─────────────────────────────────────────
  // WAU for day i = sum of dau for the 7 days ending on day i.
  // Note: this counts unique-user-days, not unique users. It matches the
  // previous behaviour of "users active in the last 7 days" when the
  // same user appears on multiple days, but is an approximation from
  // pre-computed daily data (exact deduplication would require raw events).

  const wauHistory = dateRange.map((date, i) => {
    const window = dateRange.slice(Math.max(0, i - 6), i + 1);
    const value  = window.reduce((sum, d) => sum + get(d).dau, 0);
    return { date, value };
  });
  const wauLatest = wauHistory[wauHistory.length - 1];

  // ── Paid conversion: cumulative SUM(paid_conversions) / SUM(new_signups) ──

  let cumSignups = 0;
  let cumPaid    = 0;
  const paidConvHistory = dateRange.map((date) => {
    const r = get(date);
    cumSignups += r.new_signups;
    cumPaid    += r.paid_conversions;
    return { date, value: cumSignups > 0 ? cumPaid / cumSignups : 0 };
  });
  const paidLatest = paidConvHistory[paidConvHistory.length - 1];

  // ── D28 retention: week-1 cohort still active on day 28+ ──────────────────
  // With pre-computed data we approximate: week-1 cohort size = sum of
  // new_signups for the first 7 dates. Active on day i = dau (approximation).
  // Exact per-user retention would need user_snapshots cohort analysis.

  const d28Available = currentDay >= 28;

  const week1SignupTotal = dateRange.slice(0, 7).reduce((sum, d) => sum + get(d).new_signups, 0);

  const d28History = dateRange.map((date, i) => {
    if (i < 27) return { date, value: null as number | null };
    // Rolling 7-day active users as proxy for retained users
    const window = dateRange.slice(i - 6, i + 1);
    const rollingDau = window.reduce((sum, d) => sum + get(d).dau, 0);
    // Retention = active users in week / week-1 cohort size (clamped to 0-1)
    const retention = week1SignupTotal > 0
      ? Math.min(rollingDau / (7 * week1SignupTotal), 1)
      : 0;
    return { date, value: retention };
  });

  const lastD28 = [...d28History].reverse().find((d) => d.value !== null);
  const d28Latest = lastD28
    ? {
        value:        lastD28.value!,
        user_count:   Math.round(lastD28.value! * week1SignupTotal),
        computed_on:  lastD28.date,
      }
    : null;

  return Response.json({
    window: { current_day: currentDay, window_start: windowStart },
    metrics: {
      dau: {
        label:       "DAU",
        description: "Users who opened OutX today",
        latest:      { value: dauLatest.value, user_count: dauLatest.value, computed_on: dauLatest.date },
        history:     dauHistory,
        available:   true,
      },
      d7_retention: {
        label:       "WAU / D7",
        description: "Users active in the last 7 days",
        latest:      { value: wauLatest.value, user_count: wauLatest.value, computed_on: wauLatest.date },
        history:     wauHistory,
        available:   true,
      },
      d28_retention: {
        label:       "D28 Retention",
        description: d28Available
          ? "28-day retention rate"
          : `Available after day 28 (day ${currentDay} now)`,
        latest:      d28Latest,
        history:     d28Available ? d28History : [],
        available:   d28Available,
      },
      paid_users: {
        label:       "Paid Conversion",
        description: "Trial-to-paid conversion rate",
        latest:      { value: paidLatest.value, user_count: cumPaid, computed_on: paidLatest.date },
        history:     paidConvHistory,
        available:   true,
      },
    },
  });
}
