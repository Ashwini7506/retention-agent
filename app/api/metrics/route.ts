import { supabaseAdmin } from "@/lib/supabase";

// GET /api/metrics
// Returns all metric definitions with their latest computed result
export async function GET() {
  const db = supabaseAdmin();

  const { data: definitions, error: defError } = await db
    .from("metric_definitions")
    .select("*")
    .order("created_at", { ascending: true });

  if (defError) {
    return Response.json({ error: defError.message }, { status: 500 });
  }

  const { data: results, error: resError } = await db
    .from("metric_results")
    .select("*")
    .order("computed_on", { ascending: false });

  if (resError) {
    return Response.json({ error: resError.message }, { status: 500 });
  }

  // Attach latest result to each definition
  const latestByDefinition: Record<string, (typeof results)[0]> = {};
  for (const r of results ?? []) {
    if (!latestByDefinition[r.metric_definition_id]) {
      latestByDefinition[r.metric_definition_id] = r;
    }
  }

  const merged = (definitions ?? []).map((d) => ({
    ...d,
    latest_result: latestByDefinition[d.id] ?? null,
  }));

  return Response.json(merged);
}
