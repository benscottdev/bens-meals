import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, structured } from "@/lib/claude/client";
import { CHEF_SYSTEM, consolidatePrompt, expandPrompt, repairPrompt, type PlanContext } from "@/lib/claude/prompts";
import { ConsolidateSchema, RecipeSchema, RepairSchema } from "@/lib/claude/schemas";
import { itemKey } from "@/lib/shopping/aggregate";
import type { Ingredient } from "@/lib/types";
import { rebuildShoppingList } from "./shopping";
import { pool, recipeRow } from "./util";

type PlanRecipe = { id: string; title: string; meal_type: string; servings: number; ingredients: Ingredient[] };

async function planRecipes(db: SupabaseClient, planId: string) {
  const { data } = await db.from("plan_slots").select("recipe_id, locked, skipped, recipes(id, title, meal_type, servings, ingredients)").eq("plan_id", planId);
  const byId = new Map<string, PlanRecipe & { meals: number; locked: boolean }>();
  for (const s of (data ?? []) as unknown as { locked: boolean; skipped: boolean; recipes: PlanRecipe | null }[]) {
    if (!s.recipes || s.skipped) continue;
    const e = byId.get(s.recipes.id) ?? { ...s.recipes, meals: 0, locked: false };
    e.meals++;
    e.locked ||= s.locked;
    byId.set(e.id, e);
  }
  return [...byId.values()];
}

/**
 * Merge needlessly different products across the week's recipes (two oils, three rices…) into one, rewriting the
 * recipes so the shopping list buys a single product. Returns the merges applied.
 */
export async function consolidateWeek(db: SupabaseClient, userId: string, planId: string) {
  const recipes = await planRecipes(db, planId);
  if (recipes.length < 2) return [];
  const { data: pantry } = await db.from("pantry_items").select("name").eq("user_id", userId);

  const { merges } = await structured({
    model: MODELS.planner, system: CHEF_SYSTEM, schema: ConsolidateSchema, effort: "low", maxTokens: 8000,
    prompt: consolidatePrompt(
      recipes.map((r) => ({ title: r.title, ingredients: r.ingredients.map((i) => `${i.qty} ${i.unit} ${i.name}`) })),
      (pantry ?? []).map((p) => p.name),
    ),
  });
  if (!merges.length) return [];

  // Map every "from" spelling (by normalised key) to its replacement.
  const to = new Map<string, string>();
  for (const m of merges) for (const f of m.from) if (itemKey(f) !== itemKey(m.to)) to.set(itemKey(f), m.to);

  await Promise.all(
    recipes.map(async (r) => {
      let changed = false;
      const ingredients = r.ingredients.map((i) => {
        const repl = to.get(itemKey(i.name));
        if (!repl) return i;
        changed = true;
        return { ...i, name: repl };
      });
      if (changed) await db.from("recipes").update({ ingredients }).eq("id", r.id);
    }),
  );
  return merges;
}

/**
 * If the priced list is over budget, ask Claude which (unlocked) recipes cost the most for what they give, replace
 * them with cheaper dishes that reuse what's already being bought, then consolidate and re-price. One round.
 */
export async function fitBudget(
  db: SupabaseClient, userId: string, planId: string, ctx: PlanContext, staples: string[], total: number,
  progress: (msg: string) => unknown,
): Promise<number> {
  const budget = ctx.settings.weekly_budget;
  if (total <= budget * 1.02) return total;

  await progress(`$${(total - budget).toFixed(0)} over budget — swapping the priciest meals…`);
  const [recipes, { data: items }] = await Promise.all([
    planRecipes(db, planId),
    db.from("shopping_items").select("name, est_price, have_it, recipe_ids").eq("plan_id", planId),
  ]);
  // Attribute each item's price evenly to the recipes that use it.
  const cost = new Map<string, number>();
  for (const i of items ?? []) {
    if (i.have_it || !i.est_price || !i.recipe_ids?.length) continue;
    for (const id of i.recipe_ids) cost.set(id, (cost.get(id) ?? 0) + Number(i.est_price) / i.recipe_ids.length);
  }

  const { replacements } = await structured({
    model: MODELS.planner, system: CHEF_SYSTEM, schema: RepairSchema, effort: "medium", maxTokens: 8000,
    prompt: repairPrompt(
      ctx, total,
      recipes.map((r) => ({ title: r.title, cost: cost.get(r.id) ?? 0, meals: r.meals, locked: r.locked })),
      (items ?? []).filter((i) => !i.have_it).map((i) => ({ name: i.name, price: Number(i.est_price ?? 0) })),
    ),
  });
  const targets = replacements
    .map((rep) => ({ rep, old: recipes.find((r) => r.title.toLowerCase() === rep.old_title.toLowerCase() && !r.locked) }))
    .filter((t): t is { rep: (typeof replacements)[number]; old: (typeof recipes)[number] } => !!t.old)
    .slice(0, 3);
  if (!targets.length) return total;

  const listNames = (items ?? []).map((i) => i.name);
  const fresh = await pool(targets, 3, ({ rep, old }) =>
    structured({
      model: MODELS.planner, system: CHEF_SYSTEM, schema: RecipeSchema, effort: "low",
      prompt: `${expandPrompt(ctx, { title: rep.title, brief: rep.brief, servings: old.servings, meal_type: old.meal_type, source_url: null }, staples)}
Reuse what's already being bought wherever you can: ${listNames.join(", ")}.`,
    }),
  );
  for (const [n, { old }] of targets.entries()) {
    const { data: row, error } = await db.from("recipes").insert(recipeRow(userId, fresh[n])).select("id").single();
    if (error) throw error;
    await db.from("plan_slots").update({ recipe_id: row.id }).eq("plan_id", planId).eq("recipe_id", old.id).eq("locked", false);
  }

  await consolidateWeek(db, userId, planId);
  return rebuildShoppingList(db, userId, planId);
}
