import { supabaseAdmin } from "@/lib/supabase";
import { OpenRouter } from "@openrouter/sdk";

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

  // ── 1. Fetch all raw events for this user ────────────────────────────────
  const { data: rawEvents, error: evErr } = await db
    .from("raw_events")
    .select("distinct_id, event_name, occurred_at, properties")
    .order("occurred_at", { ascending: true });

  if (evErr) return Response.json({ error: evErr.message }, { status: 500 });

  // Filter to this user's events
  const userEvents = (rawEvents ?? []).filter((e) => {
    if (device_id && e.distinct_id === device_id) return true;
    if (email) {
      const p: Record<string, string> = e.properties
        ? typeof e.properties === "string" ? JSON.parse(e.properties) : e.properties
        : {};
      if (p["$email"]?.toLowerCase() === email.toLowerCase()) return true;
      if (p["email"]?.toLowerCase() === email.toLowerCase()) return true;
    }
    return false;
  });

  // ── 2. Extract key moments ────────────────────────────────────────────────
  const moments = {
    accountCreated:  userEvents[0]?.occurred_at ?? null,
    lastSeen:        userEvents[userEvents.length - 1]?.occurred_at ?? null,
    firstLogin:      userEvents.find((e) => LOGIN_EVENTS.has(e.event_name))?.occurred_at ?? null,
    pluginInvoked:   userEvents.filter((e) => PLUGIN_EVENTS.has(e.event_name)),
    watchlistEvents: userEvents.filter((e) => WATCHLIST_EVENTS.has(e.event_name)),
    promptEvents:    userEvents.filter((e) => PROMPT_EVENTS.has(e.event_name)),
    engagementEvts:  userEvents.filter((e) => ENGAGEMENT_EVENTS.has(e.event_name)),
    demoEvents:      userEvents.filter((e) => DEMO_EVENTS.has(e.event_name)),
    paymentEvents:   userEvents.filter((e) => PAYMENT_EVENTS.has(e.event_name)),
    totalEvents:     userEvents.length,
  };

  // ── 3. Fetch backend plan data ────────────────────────────────────────────
  let planInfo: { status: string; detail: string } | null = null;
  let teamCreatedAt: string | null = null;

  if (email) {
    const team = await fetchTeamByEmail(email);
    if (team) {
      teamCreatedAt = team.created_at as string;
      planInfo = detectPlanStatus(team as {
        created_at: string;
        mention_plan_type: string;
        mention_plan_expiry_date: string | null;
      });
    }
  }

  // ── 4. Build context for Claude ───────────────────────────────────────────
  const context = `
USER: ${name || "Unknown"} | Email: ${email || "Unknown"}

ACCOUNT:
- Signed up: ${teamCreatedAt ?? moments.accountCreated ?? "Unknown"}
- Last seen: ${moments.lastSeen ?? "Unknown"}
- Total events recorded: ${moments.totalEvents}

PLAN STATUS:
- ${planInfo ? `${planInfo.status} — ${planInfo.detail}` : "Unknown (no backend data)"}

PRODUCT JOURNEY:
- First login to dashboard: ${moments.firstLogin ?? "Not recorded"}
- Plugin/extension invoked: ${moments.pluginInvoked.length > 0 ? `Yes — ${moments.pluginInvoked.length} times, last on ${moments.pluginInvoked[moments.pluginInvoked.length - 1].occurred_at}` : "No"}
- Watchlist activity: ${moments.watchlistEvents.length > 0 ? `Yes — ${moments.watchlistEvents.length} events, first on ${moments.watchlistEvents[0].occurred_at}` : "No watchlist activity"}
- Prompt flows: ${moments.promptEvents.length > 0 ? `Completed ${moments.promptEvents.length} prompt flows` : "No prompts run"}
- Post engagement (filters, interactions): ${moments.engagementEvts.length > 0 ? `Yes — ${moments.engagementEvts.length} engagement events` : "No"}
- Demo booked: ${moments.demoEvents.length > 0 ? "Yes" : "No"}
- Reached payment screen: ${moments.paymentEvents.length > 0 ? `Yes — ${moments.paymentEvents.map((e) => e.event_name).join(", ")}` : "No"}

RAW TIMELINE (last 30 events):
${userEvents.slice(-30).map((e) => `- ${e.occurred_at.slice(0, 16)}: ${e.event_name}`).join("\n")}
`.trim();

  // ── 5. Ask Claude Haiku (via OpenRouter) to write the story ─────────────
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });

  const client = new OpenRouter({ apiKey });

  const completion = await client.chat.send({
    model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5",
    messages: [
      {
        role: "user",
        content: `You are a retention analyst at OutX.AI. Based on this user's data, write a concise, human narrative (3-5 paragraphs) that tells the complete story of their journey — when they joined, what they did, how engaged they are, their plan status, and what the retention risk looks like. Write it like a story, not a bullet list. Be specific with dates and numbers. End with one clear recommendation for what the team should do.

${context}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 600,
  });

  const story = completion.choices?.[0]?.message?.content ?? "";

  return Response.json({ story, context_used: { moments, planInfo, teamCreatedAt } });
}
