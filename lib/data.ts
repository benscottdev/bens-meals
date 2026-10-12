import "server-only";
import { redirect } from "next/navigation";
import { loadSettings } from "@/lib/plan/context";
import { currentUser } from "@/lib/supabase/server";
import { nextWeekStart, weekStart, type MealPlan, type PlanSlot, type Recipe, type Settings } from "@/lib/types";

export async function session() {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function settingsOrOnboard(): Promise<Settings> {
  const { supabase, user } = await session();
  const s = await loadSettings(supabase, user.id);
  if (!s.onboarded) redirect("/onboarding");
  return s;
}

export function resolveWeek(week?: string) {
  return week === "next" ? nextWeekStart() : week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : weekStart();
}

export async function getPlan(week: string): Promise<{ plan: MealPlan | null; slots: PlanSlot[] }> {
  const { supabase, user } = await session();
  const { data: plan } = await supabase.from("meal_plans").select("*")
    .eq("user_id", user.id).eq("week_start", week).neq("status", "archived").maybeSingle();
  if (!plan) return { plan: null, slots: [] };
  const { data: slots } = await supabase.from("plan_slots").select("*, recipe:recipes(*)").eq("plan_id", plan.id);
  return { plan: plan as MealPlan, slots: (slots ?? []) as PlanSlot[] };
}

/** The plan to show on Shop/Prep: this week's, else next week's if already planned. */
export async function getActivePlan() {
  const cur = await getPlan(weekStart());
  if (cur.plan?.status === "ready") return cur;
  const next = await getPlan(nextWeekStart());
  return next.plan ? next : cur;
}

export async function getRecipe(id: string) {
  const { supabase } = await session();
  const [{ data: recipe }, { data: feedback }] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).maybeSingle(),
    supabase.from("recipe_feedback").select("*").eq("recipe_id", id).maybeSingle(),
  ]);
  return { recipe: recipe as Recipe | null, feedback };
}

export async function getFavourites(): Promise<Recipe[]> {
  const { supabase } = await session();
  const { data } = await supabase.from("recipe_feedback").select("recipes(*)").eq("favourite", true);
  return (data ?? []).map((d) => d.recipes as unknown as Recipe).filter(Boolean);
}

export type SavedWeek = { id: string; name: string; created_at: string; est_total: number | null; meals: number };

export async function getSavedWeeks(): Promise<SavedWeek[]> {
  const { supabase } = await session();
  const { data, error } = await supabase.from("saved_weeks").select("id, name, created_at, est_total, slots").order("created_at", { ascending: false });
  if (error) return []; // table not created yet
  return (data ?? []).map((w) => ({ id: w.id, name: w.name, created_at: w.created_at, est_total: w.est_total, meals: (w.slots as unknown[]).length }));
}
