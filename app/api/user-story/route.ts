import { supabaseAdmin } from "@/lib/supabase";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// POST /api/user-story
// Body: { email: string, device_id: string, name: string }
// Returns: { story: string }
//
// Combines:
//   1. Mixpanel raw_events (Supabase) — full behaviour timeline
//   2. OutX backend API             — plan, trial status, team creation date
// Then asks Claude to write a human narrative of the user's journey.

const PLUGIN_EVENTS = new Set([
  "extension_page_extension_installed",
  "extension_page_viewed",
  "ai_onboarding_modal_extension_screen_viewed",
]);

const WATCHLIST_EVENTS = new Set([
  "viewed_watchlist_details_page",
  "viewed_reddit_watchlist_details_page",
  "watchlist_sidebar_clicked",
  "viewed_lists_page",
]);

const PROMPT_EVENTS = new Set([
  "prompt_flow_completed",
  "prompt_loading_modal_shown",
]);

const ENGAGEMENT_EVENTS = new Set([
  "filter_label_used",
  "filter_show_interactions_used",
  "filter_posted_date_used",
  "ai_onboarding_modal_suggestion_card_clicked",
  "ai_onboarding_modal_start_listening_clicked",
]);

const DEMO_EVENTS = new Set([
  "book_demo_clicked",
  "demo_booked",
  "demo_requested",
  "calendly_opened",
]);

const PAYMENT_EVENTS = new Set([
  "payment_modal_checkout_completed",
  "payment_modal_payment_button_clicked",
  "payment_modal_trial_button_clicked",
  "payment_modal_plan_viewed",
  "payment_modal_modal_viewed",
  "ai_onboarding_modal_billing_screen_shown",
]);

const LOGIN_EVENTS = new Set([
  "user_logged_in",
  "login_button_clicked",
  "viewed_dashboard_page",
]);

// ── Trial vs Paid detection ───────────────────────────────────────────────────
function detectPlanStatus(team: {
  created_at: string;
  mention_plan_type: string;
  mention_plan_expiry_date: string | null;
}): { status: string; detail: string } {
  const { created_at, mention_plan_type, mention_plan_expiry_date } = team;

  if (mention_plan_type === "free" && !mention_plan_expiry_date) {
    return { status: "Free", detail: "On the free plan with no trial active." };
  }

  if (mention_plan_expiry_date) {
    const signupMs  = new Date(created_at).getTime();
    const expiryMs  = new Date(mention_plan_expiry_date).getTime();
    const diffDays  = Math.round((expiryMs - signupMs) / 86_400_000);
    const daysLeft  = Math.round((expiryMs - Date.now()) / 86_400_000);

    if (diffDays <= 7) {
      return {
        status: "Free Trial",
        detail: `On a 7-day free trial of the ${mention_plan_type} plan. Trial expires ${mention_plan_expiry_date}. ${daysLeft > 0 ? `${daysLeft} days left.` : "Trial has expired."}`,
      };
    } else {
      return {
        status: "Paid",
        detail: `On the ${mention_plan_type} plan (paid). Plan active until ${mention_plan_expiry_date}.`,
      };
    }
  }

  return {
    status: mention_plan_type,
    detail: `On the ${mention_plan_type} plan.`,
  };
}

// ── Fetch team data from OutX backend ────────────────────────────────────────
async function fetchTeamByEmail(email: string): Promise<Record<string, unknown> | null> {
  const token = process.env.OUTX_ADMIN_TOKEN;
  if (!token) return null;

  // Search through pages for matching email
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://api.outx.ai/functions/v1/admin_get_all_teams?page=${page}&page_size=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          origin: "https://mentions.outx.ai",
        },
      }
    );
    if (!res.ok) break;
    const json = await res.json() as { teams: Record<string, unknown>[]; total_pages: number };
    const teams = json.teams ?? [];

    const match = teams.find((t) => {
      const users = t.users as { email: string }[] | undefined;
      return users?.some((u) => u.email?.toLowerCase() === email.toLowerCase());
    });

    if (match) return match;
    if (page >= (json.total_pages ?? 1)) break;
  }
  return null;
}

export async function POST(req: Request) {
  const { email, device_id, name } = await req.json();

  if (!email && !device_id) {
    return Response.json({ error: "email or device_id required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // ── 1. Fetch snapshot for this user (to get canonical distinct_id) ────────
  let snapshotRow: Record<string, unknown> | null = null;
  if (device_id) {
    const { data } = await db.from("user_snapshots").select("*").eq("distinct_id", device_id).single();
    snapshotRow = data;
  }
  if (!snapshotRow && email) {
    const { data } = await db.from("user_snapshots").select("*").eq("email", email).limit(1).single();
    snapshotRow = data;
  }

  const canonicalId: string | null = (snapshotRow?.distinct_id as string) ?? device_id ?? null;

  // ── 2. Fetch this user's raw events (filtered by distinct_id) ────────────
  let userEvents: { event_name: string; occurred_at: string }[] = [];
  if (canonicalId) {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await db
        .from("raw_events")
        .select("event_name, occurred_at")
        .eq("distinct_id", canonicalId)
        .order("occurred_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error || !data) break;
      userEvents.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  // ── 3. Compute data window (what dates our DB covers) ────────────────────
  const { data: windowRows } = await db
    .from("metrics_daily")
    .select("date")
    .order("date", { ascending: true });
  const allDates   = (windowRows ?? []).map((r) => r.date as string);
  const dataFrom   = allDates[0]    ?? "unknown";
  const dataTo     = allDates[allDates.length - 1] ?? "unknown";

  // ── 4. Build rich behavioural facts ──────────────────────────────────────
  // Activity by date — which days was the user active and how many actions
  const activityByDate: Record<string, number> = {};
  for (const ev of userEvents) {
    const d = ev.occurred_at.slice(0, 10);
    activityByDate[d] = (activityByDate[d] ?? 0) + 1;
  }
  const activeDays = Object.keys(activityByDate).sort();

  // Extension install — exact datetime
  const installEvent = userEvents.find((e) => e.event_name === "extension_page_extension_installed");

  // Feature usage counts
  const featureCounts: Record<string, number> = {};
  const FEATURE_LABELS: Record<string, string> = {
    "extension_page_extension_installed":    "Installed browser extension",
    "prompt_flow_completed":                  "Ran a prompt",
    "prompt_loading_modal_shown":             "Started a prompt",
    "viewed_watchlist_details_page":          "Viewed LinkedIn watchlist",
    "viewed_reddit_watchlist_details_page":   "Viewed Reddit watchlist",
    "viewed_lists_page":                      "Viewed lists page",
    "watchlist_sidebar_clicked":              "Opened watchlist sidebar",
    "filter_label_used":                      "Used label filter",
    "filter_show_interactions_used":          "Used interactions filter",
    "filter_posted_date_used":                "Used date filter",
    "filter_people_used":                     "Used people filter",
    "filter_post_type_used":                  "Used post type filter",
    "payment_modal_modal_viewed":             "Opened pricing page",
    "payment_modal_plan_viewed":              "Viewed a plan",
    "payment_modal_payment_button_clicked":   "Clicked to pay",
    "payment_modal_trial_button_clicked":     "Clicked to start trial",
    "payment_modal_checkout_completed":       "Completed checkout",
    "ai_onboarding_modal_billing_screen_shown": "Reached billing in onboarding",
    "list_csv_exported":                      "Exported a CSV",
    "list_emails_fetched":                    "Fetched emails from a list",
    "create_list_modal_opened":               "Opened create list",
    "user_registered":                        "Registered an account",
    "user_logged_in":                         "Logged in",
  };
  for (const ev of userEvents) {
    if (FEATURE_LABELS[ev.event_name]) {
      featureCounts[ev.event_name] = (featureCounts[ev.event_name] ?? 0) + 1;
    }
  }

  // Session gaps — find the longest quiet period between active days
  let longestGapDays = 0;
  for (let i = 1; i < activeDays.length; i++) {
    const gap = (new Date(activeDays[i]).getTime() - new Date(activeDays[i - 1]).getTime()) / 86_400_000;
    if (gap > longestGapDays) longestGapDays = Math.round(gap);
  }

  // ── 5. Fetch backend plan data ────────────────────────────────────────────
  let planInfo: { status: string; detail: string } | null = null;
  let teamCreatedAt: string | null = null;
  const userEmail = email ?? (snapshotRow?.email as string) ?? null;

  if (userEmail) {
    const team = await fetchTeamByEmail(userEmail);
    if (team) {
      teamCreatedAt = team.created_at as string;
      planInfo = detectPlanStatus(team as {
        created_at: string;
        mention_plan_type: string;
        mention_plan_expiry_date: string | null;
      });
    }
  }

  // Plan from snapshot as fallback
  const planFromSnapshot = snapshotRow?.plan_type as string | null;
  const churnScore    = snapshotRow?.churn_score    as number | null;
  const riskLevel     = snapshotRow?.risk_level     as string | null;
  const daysSinceLast = snapshotRow?.days_since_last as number | null;

  // ── 6. Build factual context ──────────────────────────────────────────────
  const featureLines = Object.entries(featureCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => `  • ${FEATURE_LABELS[k]}: ${c} time${c > 1 ? "s" : ""}`)
    .join("\n");

  const activityLine = activeDays.length > 0
    ? activeDays.map((d) => `${d} (${activityByDate[d]} actions)`).join(", ")
    : "No recorded activity";

  const context = `
DATA WINDOW: Our records cover ${dataFrom} to ${dataTo}. Everything below is based solely on activity within this period.

USER: ${name || snapshotRow?.name || "Unknown"} | Email: ${userEmail ?? "Unknown"}

ACCOUNT FACTS:
- Account created (OutX backend): ${teamCreatedAt ?? "Not available — data from Mixpanel only"}
- First activity in our data: ${activeDays[0] ?? "None"}
- Last activity in our data: ${activeDays[activeDays.length - 1] ?? "None"}
- Total actions recorded in this window: ${userEvents.length}
- Number of active days: ${activeDays.length}
- Longest gap between active days: ${longestGapDays > 0 ? `${longestGapDays} days` : "N/A"}

CURRENT PLAN (as of today):
- ${planInfo ? `${planInfo.status} — ${planInfo.detail}` : planFromSnapshot ? `${planFromSnapshot} (from activity data — no billing system access)` : "Not known"}

RISK ASSESSMENT (pre-computed):
- Churn score: ${churnScore != null ? `${churnScore}/100` : "Not computed"}
- Risk level: ${riskLevel ?? "Unknown"}
- Days since last activity: ${daysSinceLast != null ? `${daysSinceLast} days` : "Unknown"}

BROWSER EXTENSION:
- Installed: ${installEvent ? `Yes — on ${installEvent.occurred_at.slice(0, 16)} UTC` : "Not recorded in this window"}

FEATURES USED (all-time within data window):
${featureLines || "  No tracked features used"}

ACTIVE DAYS AND VOLUME:
${activityLine}
`.trim();

  // ── 7. Check cache — if story was generated today, return it ────────────
  const todayUTC = new Date().toISOString().slice(0, 10);
  if (
    canonicalId &&
    snapshotRow?.story &&
    snapshotRow?.story_generated_date === todayUTC
  ) {
    return Response.json({ story: snapshotRow.story as string, cached: true });
  }

  // ── 8. Ask Claude to write the story ─────────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://funnelmind.outx.ai",
      "X-Title": "FunnelMind",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5",
      messages: [
        {
          role: "user",
          content: `You are a sharp analyst writing a brief case note on a user. Write in a mix of short paragraphs and bullet points — not all bullets, not all prose.

Structure:
1. One short paragraph (2 sentences max): who they are, what plan they're on, when they first appeared. If they installed the browser plugin, include the exact date and time here.
2. Bullet points — one per active day: date, total actions, and what they mainly did (e.g. "Viewed LinkedIn watchlist 30×, ran 3 prompts, logged in twice")
3. One short paragraph (1-2 sentences): summary of their overall activity — what they used most, last seen, total actions.
4. ONE final sentence starting with "Risk:" — state their risk level and the specific reasons why based on the data (e.g. "Risk: Critical — inactive for 13 days and never reached the paywall." or "Risk: At risk — only 8 total events across 2 days, never installed the extension."). Use the churn score and risk level from the RISK ASSESSMENT section.

Rules:
- Use numbers, not words: "104×" not "one hundred and four times"
- Plain English only — no technical event names
- Do NOT say "funnel", "paywall", "modal" — use plain equivalents ("pricing page", "payment screen", "popup")
- The Risk sentence must be specific — name the actual reason(s), not just the label
- Keep the whole thing under 200 words

${context}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: `OpenRouter error: ${err}` }, { status: 500 });
  }

  const json = await res.json();
  const story = (json.choices?.[0]?.message?.content ?? "") as string;

  // ── 9. Cache the story in user_snapshots ─────────────────────────────────
  if (canonicalId && story) {
    await db
      .from("user_snapshots")
      .update({ story, story_generated_date: todayUTC })
      .eq("distinct_id", canonicalId);
  }

  return Response.json({ story, cached: false });
}
