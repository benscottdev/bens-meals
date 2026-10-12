import { after, NextResponse } from "next/server";
import { loadContext } from "@/lib/plan/context";
import { generatePlan } from "@/lib/plan/generate";
import { createServiceClient, currentUser } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Starts (re)generating a week. Returns the plan id immediately; progress lands on the plan row. */
export async function POST(req: Request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const userId = user.id;
  const { weekStart } = (await req.json()) as { weekStart: string };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return NextResponse.json({ error: "Bad week" }, { status: 400 });

  const ctx0 = await loadContext(supabase, userId);
  const { data: existing } = await supabase.from("meal_plans").select("id, status, progress")
    .eq("user_id", userId).eq("week_start", weekStart).neq("status", "archived").maybeSingle();

  // A run is "stuck" if it hasn't finished within the function's lifetime.
  if (existing?.status === "generating") return NextResponse.json({ planId: existing.id, already: true });

  let planId = existing?.id as string | undefined;
  const fields = {
    status: "generating", budget: ctx0.settings.weekly_budget, store: ctx0.settings.store,
    settings_snapshot: ctx0.settings, progress: { stage: "plan", message: "Warming up the oven…" },
  };
  if (planId) {
    await supabase.from("meal_plans").update(fields).eq("id", planId);
  } else {
    const { data, error } = await supabase.from("meal_plans").insert({ ...fields, user_id: userId, week_start: weekStart }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    planId = data.id;
  }

  const ctx = await loadContext(supabase, userId, planId);
  after(() => generatePlan(createServiceClient(), userId, planId!, ctx));
  return NextResponse.json({ planId });
}
