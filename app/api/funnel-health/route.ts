import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/funnel-health
// Reads funnel definitions from funnel_versions + funnel_blocks.
// Auto-seeds the default OutX funnel on first run if nothing exists.

const NEW_USER_VERSION_ID      = "a1b2c3d4-0000-0000-0000-000000000001";
const RETURNING_VERSION_ID     = "a1b2c3d4-0000-0000-0000-000000000002";

const DEFAULT_NEW_BLOCKS = [
  // ONLY user_registered — other signup events (Register Button Clicked, otp_sent, etc.)
  // are pre-registration actions that fire under anonymous IDs and inflate the count.
  // Backend DB confirms ~32 real signups; Mixpanel fires user_registered for ~9.
  // This gives the truest funnel from Mixpanel data until instrumentation is fixed.
  { step_order: 1, name: "Signed Up",             events: ["user_registered"] },
  // Extension install is tracked in OutX backend only — Mixpanel has ~4 events.
  // Shown as independent metric, NOT required for downstream steps.
  { step_order: 2, name: "Installed Extension",   events: ["extension_page_extension_installed"] },
  // Watchlist/Prompt is a WEB feature — no extension required. 29/32 users reach this.
  { step_order: 3, name: "Used Watchlist / Prompt", events: ["prompt_flow_completed","prompt_loading_modal_shown","viewed_watchlist_details_page","viewed_reddit_watchlist_details_page","viewed_lists_page","watchlist_sidebar_clicked","filter_label_used","filter_show_interactions_used","filter_posted_date_used"] },
  { step_order: 4, name: "Reached Paywall",       events: ["payment_modal_modal_viewed","payment_modal_plan_viewed","payment_modal_payment_button_clicked","payment_modal_trial_button_clicked","payment_modal_checkout_completed","ai_onboarding_modal_billing_screen_shown","post_onboarding_modal_billing_screen_shown"] },
];

const DEFAULT_RETURNING_BLOCKS = [
  { step_order: 1, name: "Came Back",             events: ["viewed_dashboard_page","viewed_watchlist_details_page","viewed_reddit_watchlist_details_page","viewed_lists_page","viewed_watchlist_page","viewed_activity_page","extension_page_viewed","prompt_flow_completed","prompt_loading_modal_shown","watchlist_sidebar_clicked","filter_label_used","filter_show_interactions_used","filter_posted_date_used","payment_modal_modal_viewed","payment_modal_plan_viewed","payment_modal_payment_button_clicked","payment_modal_trial_button_clicked","payment_modal_checkout_completed"] },
  { step_order: 2, name: "Opened Watchlist",      events: ["viewed_watchlist_details_page","viewed_watchlist_page","watchlist_sidebar_clicked"] },
  { step_order: 3, name: "Ran a Prompt",          events: ["prompt_flow_completed","prompt_loading_modal_shown"] },
  { step_order: 4, name: "Used Reddit Watchlist", events: ["viewed_reddit_watchlist_details_page"] },
  { step_order: 5, name: "Used Filters",          events: ["filter_label_used","filter_show_interactions_used","filter_posted_date_used"] },
  { step_order: 6, name: "Viewed Lists",          events: ["viewed_lists_page"] },
  { step_order: 7, name: "Hit Paywall",           events: ["payment_modal_modal_viewed","payment_modal_plan_viewed","payment_modal_payment_button_clicked","payment_modal_trial_button_clicked","payment_modal_checkout_completed","ai_onboarding_modal_billing_screen_shown","post_onboarding_modal_billing_screen_shown"] },
];

async function ensureFunnelSeeded(db: ReturnType<typeof supabaseAdmin>) {
  // Always upsert versions + delete/re-insert blocks so changes to DEFAULT_*_BLOCKS
  // take effect immediately without manual DB intervention.
  await db.from("funnel_versions").upsert([
    { id: NEW_USER_VERSION_ID,  name: "OutX Default Funnel",          is_active: true },
    { id: RETURNING_VERSION_ID, name: "OutX Returning User Funnel",   is_active: true },
  ]);

  await db.from("funnel_blocks").delete().in("funnel_version_id", [NEW_USER_VERSION_ID, RETURNING_VERSION_ID]);

  await db.from("funnel_blocks").insert([
    ...DEFAULT_NEW_BLOCKS.map((b)       => ({ ...b, funnel_version_id: NEW_USER_VERSION_ID })),
    ...DEFAULT_RETURNING_BLOCKS.map((b) => ({ ...b, funnel_version_id: RETURNING_VERSION_ID })),
  ]);
}

export async function GET() {
  try {
    const db = supabaseAdmin();

  await ensureFunnelSeeded(db);

  // ── Load both funnel definitions ──────────────────────────────────────────

  const { data: allBlocks } = await db
    .from("funnel_blocks")
    .select("id, funnel_version_id, name, step_order, events")
    .in("funnel_version_id", [NEW_USER_VERSION_ID, RETURNING_VERSION_ID])
    .order("step_order", { ascending: true });

  const newBlocks       = (allBlocks ?? []).filter((b) => b.funnel_version_id === NEW_USER_VERSION_ID);
  const returningBlocks = (allBlocks ?? []).filter((b) => b.funnel_version_id === RETURNING_VERSION_ID);

  // ── Load all raw events + users ───────────────────────────────────────────

  const [eventsRes, usersRes] = await Promise.all([
    db.from("raw_events").select("distinct_id, event_name, occurred_at, properties").limit(100000),
    db.from("users").select("distinct_id, name, email, city, country, utm_source, plan_type, acquisition_source"),
  ]);

  if (eventsRes.error) {
    return Response.json({ error: eventsRes.error.message }, { status: 500 });
  }

  const evs = eventsRes.data ?? [];

  // ── Build user profile lookup ─────────────────────────────────────────────

  const usersByDistinctId: Record<string, {
    name: string; email: string; city: string; country: string;
    utm_source: string; plan_type: string; acquisition_source: string;
  }> = {};
  for (const u of (usersRes.data ?? [])) {
    usersByDistinctId[u.distinct_id] = {
      name:               u.name               ?? "",
      email:              u.email              ?? "",
      city:               u.city               ?? "",
      country:            u.country            ?? "",
      utm_source:         u.utm_source         ?? "",
      plan_type:          u.plan_type          ?? "",
      acquisition_source: u.acquisition_source ?? "",
    };
  }

  // ── Per-device accumulation ───────────────────────────────────────────────

  type DeviceData = {
    events:       Set<string>;
    distinct_ids: Set<string>;
    name:         string;
    email:        string;
    city:         string;
    country:      string;
    utm_source:   string;
    plan_type:    string;
    lastTs:       number;
    totalEvents:  number;
  };

  const devices: Record<string, DeviceData> = {};
  let maxTs = 0;

  const pick = (current: string, candidate: string | null | undefined): string => {
    if (current && current !== "null") return current;
    const c = (candidate ?? "").trim();
    return c && c !== "null" ? c : current;
  };

  for (const e of evs) {
    const p: Record<string, string> = e.properties
      ? typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties
      : {};

    // Identified users (non-anonymous distinct_id) must be grouped by distinct_id.
    // Device ID changes per browser session, so the same user's signup event and
    // extension install event end up with different Device IDs — breaking the funnel.
    // Only fall back to Device ID for anonymous ($device:) users to link pre-login events.
    const device_id = e.distinct_id.startsWith("$device:")
      ? (p["Device ID"] || e.distinct_id).trim()
      : e.distinct_id;

    if (!devices[device_id]) {
      devices[device_id] = {
        events: new Set(), distinct_ids: new Set(),
        name: "", email: "", city: "", country: "", utm_source: "", plan_type: "",
        lastTs: 0, totalEvents: 0,
      };
    }

    const ts = new Date(e.occurred_at).getTime();
    if (ts > maxTs) maxTs = ts;

    const d = devices[device_id];
    d.events.add(e.event_name);
    d.distinct_ids.add(e.distinct_id);
    d.totalEvents++;
    if (ts > d.lastTs) d.lastTs = ts;

    const profile = usersByDistinctId[e.distinct_id];
    if (profile) {
      d.name       = pick(d.name,       profile.name);
      d.email      = pick(d.email,      profile.email);
      d.city       = pick(d.city,       profile.city);
      d.country    = pick(d.country,    profile.country);
      d.utm_source = pick(d.utm_source, profile.utm_source || profile.acquisition_source);
      d.plan_type  = pick(d.plan_type,  profile.plan_type);
    }
  }

  const allDeviceIds = Object.keys(devices);

  // A device is "identified" if at least one distinct_id is NOT anonymous
  const isIdentified = (did: string) =>
    Array.from(devices[did].distinct_ids).some((id) => !id.startsWith("$device:"));

  // ── Build step event sets for fast lookup (separate for each funnel) ────────

  const makeStepSets = (blockList: typeof newBlocks) =>
    blockList.map((b) => new Set<string>(b.events as string[]));

  const newStepSets       = makeStepSets(newBlocks);
  const returningStepSets = makeStepSets(returningBlocks);

  const hasNewStep       = (did: string, i: number) => [...newStepSets[i]].some((e) => devices[did].events.has(e));
  const hasReturnStep    = (did: string, i: number) => [...returningStepSets[i]].some((e) => devices[did].events.has(e));

  // ── Classify devices ──────────────────────────────────────────────────────

  // New users: fired any event from step 0 of the new user funnel (registration events)
  const newDevices = allDeviceIds.filter((d) => hasNewStep(d, 0));
  const newSet     = new Set(newDevices);

  // Returning users: identified, not a new signup, fired any event from step 0 of returning funnel
  const returningDevices = allDeviceIds.filter((d) =>
    isIdentified(d) && !newSet.has(d) && hasReturnStep(d, 0)
  );

  // ── Count devices at each funnel step ─────────────────────────────────────

  // Sequential: each step requires ALL prior steps (used for new user funnel).
  // Steps where ZERO devices have data are auto-skipped — this handles cases
  // where events aren't tracked in Mixpanel (e.g. extension installs).
  const buildSequentialSteps = (deviceList: string[], blockList: typeof newBlocks, hasFn: (did: string, i: number) => boolean) => {
    // Pre-compute which steps have any data at all in this dataset
    const stepHasData = blockList.map((_, i) => deviceList.some((d) => hasFn(d, i)));
    return blockList.map((block, i) => ({
      key:         block.id,
      label:       block.name,
      count:       deviceList.filter((d) => {
        for (let j = 0; j <= i; j++) {
          // Only enforce the step if it has actual event data — skip empty steps
          if (stepHasData[j] && !hasFn(d, j)) return false;
        }
        return true;
      }).length,
      description: `Devices that fired: ${(block.events as string[]).slice(0, 2).join(", ")}${(block.events as string[]).length > 2 ? "…" : ""}`,
    }));
  };

  // Independent: each feature counted separately as % of base (used for returning user adoption bars)
  const buildIndependentSteps = (deviceList: string[], blockList: typeof newBlocks, hasFn: (did: string, i: number) => boolean) =>
    blockList.map((block, i) => ({
      key:         block.id,
      label:       block.name,
      count:       deviceList.filter((d) => hasFn(d, i)).length,
      description: `Devices that fired: ${(block.events as string[]).slice(0, 2).join(", ")}${(block.events as string[]).length > 2 ? "…" : ""}`,
    }));

  const newUserFunnel       = buildSequentialSteps(newDevices,       newBlocks,       hasNewStep);
  const returningUserFunnel = buildIndependentSteps(returningDevices, returningBlocks, hasReturnStep);

  // ── Per-user table rows ───────────────────────────────────────────────────

  const lastStep = (did: string, blockList: typeof newBlocks, hasFn: (did: string, i: number) => boolean): string => {
    for (let i = blockList.length - 1; i >= 0; i--) {
      if (hasFn(did, i)) return blockList[i].name;
    }
    return "Unknown";
  };

  const parseUtm = (raw: string): string => {
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

  const makePlan = (raw: string): string => {
    if (!raw || raw === "null") return "—";
    if (raw === "free") return "Free Trial";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const now = maxTs || Date.now();

  const churnScore = (events: Set<string>, daysSinceLast: number, totalEvs: number, plan: string): number => {
    let s = 0;
    // Stage
    const PAYMENT = ["payment_modal_modal_viewed","payment_modal_plan_viewed","payment_modal_payment_button_clicked","payment_modal_trial_button_clicked","payment_modal_checkout_completed"];
    const CORE    = ["viewed_watchlist_details_page","prompt_flow_completed","prompt_loading_modal_shown","filter_label_used","watchlist_sidebar_clicked"];
    const ONBOARD = ["ai_onboarding_modal_listen_screen_viewed","ai_onboarding_modal_extension_screen_viewed"];
    const REG     = ["user_registered","Register Button Clicked","google_signup_button_clicked_register_page"];
    if (PAYMENT.some((e) => events.has(e)))      s += 0;
    else if (CORE.some((e) => events.has(e)))    s += 10;
    else if (ONBOARD.some((e) => events.has(e))) s += 20;
    else if (REG.some((e) => events.has(e)))     s += 35;
    else                                          s += 30;
    // Recency
    s += Math.min(daysSinceLast * 9, 35);
    // Depth
    if (totalEvs < 5)       s += 15;
    else if (totalEvs < 15) s += 8;
    else if (totalEvs < 30) s += 3;
    // Plan
    const p = plan.toLowerCase();
    if (["paid","premium","pro","business"].some((k) => p.includes(k))) s += 0;
    else if (p === "—" || p === "")                                      s += 15;
    else                                                                  s += 10;
    return Math.min(Math.round(s), 100);
  };

  const riskLevel = (score: number): "healthy" | "at-risk" | "critical" =>
    score >= 61 ? "critical" : score >= 31 ? "at-risk" : "healthy";

  const buildRow = (did: string, blockList: typeof newBlocks, hasFn: (did: string, i: number) => boolean) => {
    const d = devices[did];
    const loc = [d.city, d.country].filter((x) => x && x !== "null").join(", ") || "—";
    const plan = makePlan(d.plan_type);
    const daysSinceLast = Math.floor((now - d.lastTs) / 86_400_000);
    const score = churnScore(d.events, daysSinceLast, d.totalEvents, plan);
    return {
      device_id:    did,
      name:         d.name  && d.name  !== "null" ? d.name  : "—",
      email:        d.email && d.email !== "null" ? d.email : "—",
      location:     loc,
      utm_source:   parseUtm(d.utm_source),
      plan,
      last_step:    lastStep(did, blockList, hasFn),
      churn_score:  score,
      risk_level:   riskLevel(score),
      distinct_ids: Array.from(d.distinct_ids),
    };
  };

  return Response.json({
    funnel_name:   "OutX Default Funnel",
    new_users:     newUserFunnel,
    old_users:     returningUserFunnel,
    new_user_rows: newDevices.map((d) => buildRow(d, newBlocks, hasNewStep)),
    old_user_rows: returningDevices.map((d) => buildRow(d, returningBlocks, hasReturnStep)),
    summary: {
      new_user_count:  newDevices.length,
      old_user_count:  returningDevices.length,
      anonymous_count: allDeviceIds.filter((d) => !isIdentified(d) && !newSet.has(d)).length,
      total_devices:   allDeviceIds.length,
    },
  });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
