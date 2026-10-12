import type { RecipeOut } from "@/lib/claude/schemas";

/** Run `fn` over `items` with at most `limit` in flight. */
export async function pool<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export function recipeRow(userId: string, r: RecipeOut) {
  return {
    user_id: userId,
    title: r.title, description: r.description, meal_type: r.meal_type, cuisine: r.cuisine,
    servings: Math.max(1, r.servings), prep_minutes: r.prep_minutes, cook_minutes: r.cook_minutes,
    difficulty: Math.min(5, Math.max(1, r.difficulty)),
    meal_prep_friendly: r.meal_prep_friendly, freezer_friendly: r.freezer_friendly, fridge_days: r.fridge_days,
    kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, est_cost: r.est_cost,
    ingredients: r.ingredients, steps: r.steps, tags: r.tags,
    source: r.source_url ? "web" : "generated", source_url: r.source_url,
  };
}
