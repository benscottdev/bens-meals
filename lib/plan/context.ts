import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanContext } from "@/lib/claude/prompts";
import type { Eater, Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  weekly_budget: 150,
  store: "woolworths",
  postcode: null,
  meal_grid: {
    mon: ["breakfast", "lunch", "dinner", "snack"], tue: ["breakfast", "lunch", "dinner", "snack"],
    wed: ["breakfast", "lunch", "dinner", "snack"], thu: ["breakfast", "lunch", "dinner", "snack"],
    fri: ["breakfast", "lunch", "dinner", "snack"], sat: ["breakfast", "lunch", "dinner", "snack"],
    sun: ["breakfast", "lunch", "dinner", "snack"],
  },
  leftover_nights: [],
  max_weeknight_minutes: 45,
  max_difficulty: 4,
  equipment: ["oven", "stovetop", "microwave"],
  cuisines: [],
  prep_day: null,
  meal_prep_lunches: false,
  plan_mode: "generate",
  extra_notes: null,
  dinner_time: "18:30",
  timezone: "Australia/Sydney",
  onboarded: false,
};

export async function loadSettings(db: SupabaseClient, userId: string): Promise<Settings> {
  const { data } = await db.from("settings").select("*").eq("user_id", userId).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}), weekly_budget: Number(data?.weekly_budget ?? DEFAULT_SETTINGS.weekly_budget) };
}

export async function loadContext(db: SupabaseClient, userId: string, planId?: string): Promise<PlanContext> {
  const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  const [settings, eaters, feedback, recentPlans, pantry, locked] = await Promise.all([
    loadSettings(db, userId),
    db.from("eaters").select("*").eq("user_id", userId).order("sort"),
    db.from("recipe_feedback").select("favourite, never_again, recipes(title)").eq("user_id", userId),
    db.from("plan_slots").select("recipes(title), meal_plans!inner(week_start)")
      .eq("user_id", userId).gte("meal_plans.week_start", since).not("recipe_id", "is", null),
    db.from("pantry_items").select("name").eq("user_id", userId),
    planId
      ? db.from("plan_slots").select("day, meal_type, recipes(title)").eq("plan_id", planId).eq("locked", true)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const title = (r: unknown) => (r as { recipes?: { title?: string } | null }).recipes?.title;
  const fb = feedback.data ?? [];
  return {
    settings,
    eaters: (eaters.data ?? []) as Eater[],
    favourites: fb.filter((f) => f.favourite).map(title).filter(Boolean) as string[],
    neverAgain: fb.filter((f) => f.never_again).map(title).filter(Boolean) as string[],
    recent: [...new Set((recentPlans.data ?? []).map(title).filter(Boolean) as string[])],
    pantry: (pantry.data ?? []).map((p) => p.name),
    locked: (locked.data ?? []).map((l: { day: string; meal_type: string }) => ({
      day: l.day, meal_type: l.meal_type, title: title(l) ?? "",
    })),
  };
}
