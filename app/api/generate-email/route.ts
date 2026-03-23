import { supabaseAdmin } from "@/lib/supabase";
import { OpenRouter } from "@openrouter/sdk";

// POST /api/generate-email
// Body: { user: UserRow }
// Fetches the user's events, builds context, calls OpenRouter to generate
// a personalised re-engagement email. Returns { subject, body }.

const FUNNEL_LABELS: Record<string, string> = {
  "Signed Up":           "signed up but never opened the product",
  "Got Into App":        "opened the product but didn't start setup",
  "AI Onboarding":       "started onboarding but didn't finish setting up",
  "Watchlist / Prompts": "set up a watchlist or ran a prompt but hasn't returned",
  "Payment":             "reached the payment screen but didn't convert",
};

function humanizeEvent(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractInsights(events: { event_name: string; occurred_at: string }[]): {
  usedWatchlist: boolean;
  ranPrompts: boolean;
  reachedPayment: boolean;
  watchlistKeywords: string[];
  promptKeywords: string[];
  keyActions: string[];
} {
  const names = events.map((e) => e.event_name);
  const usedWatchlist = names.some((n) => n.includes("watchlist"));
  const ranPrompts    = names.some((n) => n.includes("prompt"));
  const reachedPayment = names.some((n) =>
    n.includes("payment") || n.includes("billing") || n.includes("plan")
  );

  // Extract meaningful unique actions (top 6, skip generic page views)
  const skip = new Set(["viewed_dashboard_page", "page_viewed", "session_started"]);
  const keyActions = [...new Set(names.filter((n) => !skip.has(n)))]
    .slice(0, 6)
    .map(humanizeEvent);

  return { usedWatchlist, ranPrompts, reachedPayment, watchlistKeywords: [], promptKeywords: [], keyActions };
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = body.user as {
    name: string;
    email: string;
    plan: string;
    funnel_stage: string;
    churn_score: number;
    days_since_last: number;
    total_events: number;
    distinct_ids: string[];
  };

  if (!user?.email) {
    return Response.json({ error: "user required" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your_openrouter_key_here") {
    return Response.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  // Fetch user's events from DB (filtered by distinct_ids — avoids row limit issue)
  const db = supabaseAdmin();
  let events: { event_name: string; occurred_at: string }[] = [];

  if (user.distinct_ids?.length) {
    const { data } = await db
      .from("raw_events")
      .select("event_name, occurred_at")
      .in("distinct_id", user.distinct_ids)
      .order("occurred_at", { ascending: true });
    events = data ?? [];
  }

  const insights = extractInsights(events);
  const firstName = user.name.split(" ")[0] || user.name;
  const stuckAt = FUNNEL_LABELS[user.funnel_stage] ?? "hasn't been active recently";
  const daysSilent = user.days_since_last === 0 ? "today" : `${user.days_since_last} day${user.days_since_last !== 1 ? "s" : ""} ago`;

  // Build the context prompt
  const systemPrompt = `You are a growth expert at OutX.AI, a LinkedIn + Reddit social listening and sales intelligence platform.
Your job is to write short, warm, personalised re-engagement emails to users who are at risk of churning.

OutX.AI helps B2B sales teams monitor LinkedIn and Reddit for keywords, companies, and people — then auto-engage and export leads to CRM.

Guidelines:
- Tone: friendly, human, not pushy or salesy. Like a teammate checking in.
- Length: 4–6 sentences max. No walls of text.
- Be specific about what they did — reference their actual activity.
- Offer one clear, low-friction next step.
- No generic "we noticed you haven't logged in" openers.
- Do not use emojis.
- Return ONLY a JSON object: { "subject": "...", "body": "..." }
  The body should use plain text with line breaks (\\n) between paragraphs. No HTML.`;

  const userPrompt = `Write a re-engagement email for this OutX.AI user:

Name: ${user.name}
Plan: ${user.plan}
Where they dropped off: ${user.funnel_stage} (${stuckAt})
Last active: ${daysSilent}
Total product interactions: ${user.total_events}
Used watchlist feature: ${insights.usedWatchlist ? "yes" : "no"}
Ran a prompt: ${insights.ranPrompts ? "yes" : "no"}
Reached payment screen: ${insights.reachedPayment ? "yes" : "no"}
Key actions they took: ${insights.keyActions.length ? insights.keyActions.join(", ") : "minimal activity"}

Write a subject line and email body. Return JSON only: { "subject": "...", "body": "..." }`;

  try {
    const client = new OpenRouter({ apiKey });

    const completion = await client.chat.send({
      model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";

    // Parse the JSON from the model response
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return Response.json({ error: "Model returned unexpected format", raw }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]) as { subject: string; body: string };
    return Response.json({ subject: parsed.subject, body: parsed.body });

  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
