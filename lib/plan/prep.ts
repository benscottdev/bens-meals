import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, structured } from "@/lib/claude/client";
import { CHEF_SYSTEM, prepPrompt } from "@/lib/claude/prompts";
import { PrepSchema } from "@/lib/claude/schemas";
import { DAY_LABEL, type Day, type Recipe, type Settings } from "@/lib/types";

type Row = { day: Day; meal_type: string; skipped: boolean; recipe_id: string | null; recipes: Recipe | null };

/** Builds the combined prep-day timeline for recipes worth batch cooking. Returns false if nothing to prep. */
export async function generatePrep(db: SupabaseClient, userId: string, planId: string, s: Settings): Promise<boolean> {
  if (!s.prep_day) return false;
  const { data } = await db.from("plan_slots").select("day, meal_type, skipped, recipe_id, recipes(*)").eq("plan_id", planId);
  const slots = ((data ?? []) as unknown as Row[]).filter((r) => r.recipes && !r.skipped);

  const byRecipe = new Map<string, { recipe: Recipe; days: string[]; lunch: boolean }>();
  for (const sl of slots) {
    const e = byRecipe.get(sl.recipe_id!) ?? { recipe: sl.recipes!, days: [], lunch: false };
    e.days.push(`${DAY_LABEL[sl.day]} ${sl.meal_type}`);
    e.lunch ||= sl.meal_type === "lunch";
    byRecipe.set(sl.recipe_id!, e);
  }
  const chosen = [...byRecipe.values()].filter(
    (e) => (e.recipe.meal_prep_friendly && e.days.length >= 2) || (s.meal_prep_lunches && e.lunch && e.recipe.meal_prep_friendly),
  );
  if (!chosen.length) return false;

  const prep = await structured({
    model: MODELS.planner,
    system: CHEF_SYSTEM,
    effort: "low",
    schema: PrepSchema,
    prompt: prepPrompt(
      chosen.map((c) => ({
        title: c.recipe.title,
        ingredients: c.recipe.ingredients.map((i) => `${i.qty} ${i.unit} ${i.name}`).join(", "),
        steps: c.recipe.steps.map((st, n) => `${n + 1}. ${st.text}`).join(" "),
      })),
      DAY_LABEL[s.prep_day],
      Object.fromEntries(chosen.map((c) => [c.recipe.title, c.days])),
    ),
  });

  await db.from("prep_sessions").delete().eq("plan_id", planId);
  await db.from("prep_sessions").insert({ user_id: userId, plan_id: planId, day: s.prep_day, timeline: prep });
  return true;
}
