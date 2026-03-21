import { supabaseAdmin } from "@/lib/supabase";

// GET /api/events/recent
// Returns the 50 most recent events for the activity feed
export async function GET() {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("raw_events")
    .select("id, distinct_id, event_name, category, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}
