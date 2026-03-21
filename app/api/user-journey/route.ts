import { supabaseAdmin } from "@/lib/supabase";

// GET /api/user-journey?device_id=...&distinct_ids=id1,id2,...
// Returns all events for a device grouped by day, in chronological order.
// Filters at the DB level using distinct_ids to avoid row-limit issues.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const device_id = searchParams.get("device_id");
  const distinctIdsParam = searchParams.get("distinct_ids");

  if (!device_id) {
    return Response.json({ error: "device_id required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  let evs: { distinct_id: string; event_name: string; occurred_at: string; event_category: string | null; properties: unknown }[] = [];

  if (distinctIdsParam) {
    // Filter at DB level using the known distinct_ids for this device
    const ids = distinctIdsParam.split(",").filter(Boolean);
    const { data, error } = await db
      .from("raw_events")
      .select("distinct_id, event_name, occurred_at, event_category, properties")
      .in("distinct_id", ids)
      .order("occurred_at", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    evs = data ?? [];
  } else {
    // Fallback: fetch all and filter in JS (may miss events if row count > 1000)
    const { data, error } = await db
      .from("raw_events")
      .select("distinct_id, event_name, occurred_at, event_category, properties")
      .order("occurred_at", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const all = data ?? [];
    evs = all.filter((e) => {
      const p: Record<string, string> =
        e.properties
          ? typeof e.properties === "string" ? JSON.parse(e.properties) : (e.properties as Record<string, string>)
          : {};
      return (p["Device ID"] || e.distinct_id).trim() === device_id;
    });
  }

  // Group by date
  const dayMap: Record<string, { time: string; name: string; category: string }[]> = {};

  for (const e of evs) {
    const date = e.occurred_at.slice(0, 10); // "YYYY-MM-DD"
    const time = e.occurred_at.slice(11, 16); // "HH:MM"
    if (!dayMap[date]) dayMap[date] = [];
    dayMap[date].push({
      time,
      name: formatEventName(e.event_name),
      category: e.event_category ?? categorise(e.event_name),
    });
  }

  const days = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({ date, events }));

  return Response.json({ device_id, days, total_events: evs.length });
}

function formatEventName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categorise(name: string): string {
  if (name.includes("payment") || name.includes("billing") || name.includes("plan")) return "Payment";
  if (name.includes("onboarding"))                                                     return "Onboarding";
  if (name.includes("watchlist") || name.includes("prompt") || name.includes("filter")) return "Core";
  if (name.includes("registered") || name.includes("login") || name.includes("auth"))  return "Auth";
  if (name.includes("dashboard") || name.includes("page") || name.includes("viewed"))  return "Navigation";
  return "Other";
}
