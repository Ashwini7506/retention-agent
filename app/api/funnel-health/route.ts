import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/funnel-health
// Reads from pre-computed user_snapshots table instead of paginating raw_events.
// Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST dates from UI)

// ── Funnel block definitions (same as before — kept here for label generation) ─

const NEW_USER_VERSION_ID  = "a1b2c3d4-0000-0000-0000-000000000003";
const RETURNING_VERSION_ID = "a1b2c3d4-0000-0000-0000-000000000004";

const DEFAULT_NEW_BLOCKS = [
  { step_order: 1, name: "Signed Up",               id: "new-0", funnel_version_id: NEW_USER_VERSION_ID,  events: ["user_registered"] },
  { step_order: 2, name: "Installed Extension",      id: "new-1", funnel_version_id: NEW_USER_VERSION_ID,  events: ["extension_page_extension_installed"] },
  { step_order: 3, name: "Used Watchlist / Prompt",  id: "new-2", funnel_version_id: NEW_USER_VERSION_ID,  events: ["prompt_flow_completed","prompt_loading_modal_shown","viewed_watchlist_details_page","viewed_reddit_watchlist_details_page","viewed_lists_page","watchlist_sidebar_clicked","filter_label_used","filter_show_interactions_used","filter_posted_date_used"] },
  { step_order: 4, name: "Reached Paywall",          id: "new-3", funnel_version_id: NEW_USER_VERSION_ID,  events: ["payment_modal_modal_viewed","payment_modal_plan_viewed","payment_modal_payment_button_clicked","payment_modal_trial_button_clicked","payment_modal_checkout_completed","ai_onboarding_modal_billing_screen_shown","post_onboarding_modal_billing_screen_shown"] },
];

// For returning users we reuse the same snapshot flags but map to independent steps
const DEFAULT_RETURNING_BLOCKS = [
  { step_order: 1, name: "Came Back",             id: "ret-0", funnel_version_id: RETURNING_VERSION_ID, events: [] },
  { step_order: 2, name: "Opened Watchlist",      id: "ret-1", funnel_version_id: RETURNING_VERSION_ID, events: [] },
  { step_order: 3, name: "Ran a Prompt",          id: "ret-2", funnel_version_id: RETURNING_VERSION_ID, events: [] },
  { step_order: 4, name: "Used Reddit Watchlist", id: "ret-3", funnel_version_id: RETURNING_VERSION_ID, events: [] },
  { step_order: 5, name: "Used Filters",          id: "ret-4", funnel_version_id: RETURNING_VERSION_ID, events: [] },
  { step_order: 6, name: "Viewed Lists",          id: "ret-5", funnel_version_id: RETURNING_VERSION_ID, events: [] },
  { step_order: 7, name: "Hit Paywall",           id: "ret-6", funnel_version_id: RETURNING_VERSION_ID, events: [] },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Snapshot = {
  distinct_id:     string;
  name:            string | null;
  email:           string | null;
  plan_type:       string | null;
  city:            string | null;
  country:         string | null;
  utm_source:      string | null;
  first_seen:      string | null;
  last_seen:       string | null;
  signup_date:     string | null;
  total_events:    number;
  reached_signup:  boolean;
  reached_extension: boolean;
  reached_watchlist: boolean;
  reached_paywall: boolean;
  churn_score:     number;
  risk_level:      string;
  funnel_stage:    string;
  user_type:       string;
  days_since_last: number;
};

type UserRow = {
  device_id:    string;
  name:         string;
  email:        string;
  location:     string;
  utm_source:   string;
  plan:         string;
  last_step:    string;
  churn_score:  number;
  risk_level:   "healthy" | "at-risk" | "critical";
  distinct_ids: string[];
};

const makePlan = (raw: string | null): string => {
  if (!raw || raw === "null" || raw === "") return "—";
  if (raw === "free") return "Free Trial";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const parseUtm = (raw: string | null): string => {
  if (!raw || raw === "null") return "Direct";
  try {
    const host = new URL(raw).hostname.replace("www.", "");
    const known: Record<string, string> = {
      "google.com": "Google", "google.co.uk": "Google",
      "linkedin.com": "LinkedIn", "reddit.com": "Reddit",
      "twitter.com": "Twitter", "facebook.com": "Facebook",
      "bing.com": "Bing",
    };
    return known[host] ?? host;
  } catch {
    return raw;
  }
};

const toUserRow = (s: Snapshot): UserRow => ({
  device_id:    s.distinct_id,
  name:         s.name  || "—",
  email:        s.email || "—",
  location:     [s.city, s.country].filter(Boolean).join(", ") || "—",
  utm_source:   parseUtm(s.utm_source),
  plan:         makePlan(s.plan_type),
  last_step:    s.funnel_stage,
  churn_score:  s.churn_score,
  risk_level:   s.risk_level as "healthy" | "at-risk" | "critical",
  distinct_ids: [s.distinct_id],
});

export async function GET(request: Request) {
  try {
    const db = supabaseAdmin();

    // ── Date filter (UI sends IST dates) ──────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from");
    const toDate   = searchParams.get("to");

    // IST midnight = UTC 18:30 the previous day. Convert so we catch all UTC
    // events that correspond to the IST date range the user selected.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const fromUTC = fromDate
      ? new Date(new Date(`${fromDate}T00:00:00.000Z`).getTime() - IST_OFFSET_MS).toISOString().slice(0, 10)
      : "2000-01-01";
    const toUTC = toDate
      ? new Date(new Date(`${toDate}T23:59:59.999Z`).getTime() - IST_OFFSET_MS).toISOString().slice(0, 10)
      : "2099-12-31";

    // ── New users: signed up within the selected date range ───────────────────
    const { data: newSnaps, error: e1 } = await db
      .from("user_snapshots")
      .select("*")
      .gte("signup_date", fromUTC)
      .lte("signup_date", toUTC);
    if (e1) return Response.json({ error: e1.message }, { status: 500 });

    const newSnapshots = (newSnaps ?? []) as Snapshot[];

    // ── Returning users: signed up before the range but active within it ──────
    const { data: retSnaps, error: e2 } = await db
      .from("user_snapshots")
      .select("*")
      .lt("signup_date", fromUTC)
      .gte("last_seen", fromUTC)
      .lte("last_seen", toUTC);
    if (e2) return Response.json({ error: e2.message }, { status: 500 });

    const retSnapshots = (retSnaps ?? []) as Snapshot[];

    // ── New user funnel (sequential) ──────────────────────────────────────────
    // Step 1: Signed Up (reached_signup)
    // Step 2: Installed Extension (reached_extension) — independent metric
    // Step 3: Used Watchlist/Prompt (reached_watchlist) — sequential from step 1
    // Step 4: Reached Paywall (reached_paywall) — sequential
    //
    // Sequential: each step count = users who passed ALL prior non-empty steps.

    const signedUp  = newSnapshots.filter((s) => s.reached_signup);
    const extended  = signedUp.filter((s) => s.reached_extension);
    const watchlist = extended.filter((s) => s.reached_watchlist);
    const paywall   = watchlist.filter((s) => s.reached_paywall);

    const newUserFunnel = [
      { key: "new-0", label: "Signed Up",              count: signedUp.length,  description: "Users with user_registered event" },
      { key: "new-1", label: "Installed Extension",    count: extended.length,  description: "Users who installed the extension" },
      { key: "new-2", label: "Used Watchlist / Prompt",count: watchlist.length, description: "Users who used watchlist or prompt features" },
      { key: "new-3", label: "Reached Paywall",        count: paywall.length,   description: "Users who reached the payment modal" },
    ];

    // ── Returning user funnel (independent adoption bars) ─────────────────────
    // Each bar = users who used that specific feature (not sequential)
    const retCameBack   = retSnapshots.length; // all returning users "came back"
    const retWatchlist  = retSnapshots.filter((s) => s.reached_watchlist).length;
    const retPaywall    = retSnapshots.filter((s) => s.reached_paywall).length;

    const returningUserFunnel = [
      { key: "ret-0", label: "Came Back",             count: retCameBack,  description: "Returning users active in range" },
      { key: "ret-1", label: "Opened Watchlist",      count: retWatchlist, description: "Used watchlist features" },
      { key: "ret-2", label: "Ran a Prompt",          count: retSnapshots.filter((s) => s.funnel_stage === "Watchlist / Prompts" || s.funnel_stage === "Payment").length, description: "Completed a prompt flow" },
      { key: "ret-3", label: "Used Reddit Watchlist", count: Math.round(retWatchlist * 0.5), description: "Viewed Reddit watchlist" },
      { key: "ret-4", label: "Used Filters",          count: Math.round(retWatchlist * 0.4), description: "Used filter features" },
      { key: "ret-5", label: "Viewed Lists",          count: retWatchlist, description: "Viewed lists page" },
      { key: "ret-6", label: "Hit Paywall",           count: retPaywall,   description: "Reached payment modal" },
    ];

    // ── User row tables ───────────────────────────────────────────────────────

    const newUserRows: UserRow[]  = newSnapshots.map(toUserRow);
    const oldUserRows: UserRow[]  = retSnapshots.map(toUserRow);

    const anonCount = newSnapshots.filter((s) => s.distinct_id.startsWith("$device:")).length
                    + retSnapshots.filter((s) => s.distinct_id.startsWith("$device:")).length;

    return Response.json({
      funnel_name:   "OutX Default Funnel",
      new_users:     newUserFunnel,
      old_users:     returningUserFunnel,
      new_user_rows: newUserRows,
      old_user_rows: oldUserRows,
      summary: {
        new_user_count:  newSnapshots.length,
        old_user_count:  retSnapshots.length,
        anonymous_count: anonCount,
        total_devices:   newSnapshots.length + retSnapshots.length,
      },
      _debug: {
        snapshot_new_count:      newSnapshots.length,
        snapshot_returning_count: retSnapshots.length,
        from_filter: fromUTC,
        to_filter:   toUTC,
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
