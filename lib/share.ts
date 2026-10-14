import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { MealPlan, PlanSlot, Recipe, ShoppingItem } from "@/lib/types";

export type SharedWeek = { kind: "week"; plan: MealPlan; slots: PlanSlot[]; items: ShoppingItem[] | null };
export type SharedRecipe = { kind: "recipe"; recipe: Recipe };

/** Resolve a public share token. Reads with the service role, so only what's selected here is ever exposed. */
export async function loadShare(token: string): Promise<SharedWeek | SharedRecipe | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const db = createServiceClient();
  const { data: link } = await db.from("share_links").select("plan_id, recipe_id, include_list").eq("token", token).is("revoked_at", null).maybeSingle();
  if (!link) return null;

  if (link.recipe_id) {
    const { data: recipe } = await db.from("recipes").select("*").eq("id", link.recipe_id).maybeSingle();
    return recipe ? { kind: "recipe", recipe: recipe as Recipe } : null;
  }
  const [{ data: plan }, { data: slots }, items] = await Promise.all([
    db.from("meal_plans").select("id, week_start, budget, store, status, progress, strategy, est_total, actual_total").eq("id", link.plan_id).maybeSingle(),
    db.from("plan_slots").select("*, recipe:recipes(*)").eq("plan_id", link.plan_id),
    link.include_list ? db.from("shopping_items").select("*").eq("plan_id", link.plan_id).order("name") : Promise.resolve({ data: null }),
  ]);
  if (!plan) return null;
  return { kind: "week", plan: plan as MealPlan, slots: (slots ?? []) as PlanSlot[], items: (items.data ?? null) as ShoppingItem[] | null };
}
