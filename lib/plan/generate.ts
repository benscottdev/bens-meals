import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, structured } from "@/lib/claude/client";
import { CHEF_SYSTEM, expandPrompt, skeletonPrompt, type PlanContext } from "@/lib/claude/prompts";
import { RecipeSchema, SkeletonSchema, type Skeleton } from "@/lib/claude/schemas";
import { generatePrep } from "./prep";
import { consolidateWeek, fitBudget } from "./optimise";
import { scheduleReminders } from "./reminders";
import { rebuildShoppingList } from "./shopping";
import { pool, recipeRow } from "./util";

export { recipeRow } from "./util";

/** Serves for a slot = sum of the appetites of the eaters there (at least one). */
export function servesFor(names: string[], ctx: PlanContext): { serves: number; ids: string[] } {
  const match = ctx.eaters.filter((e) => names.some((n) => n.toLowerCase() === e.name.toLowerCase()));
  const list = match.length ? match : ctx.eaters;
  const serves = list.reduce((t, e) => t + Number(e.appetite), 0) || 1;
  return { serves: Math.round(serves * 2) / 2, ids: list.map((e) => e.id) };
}

/**
 * Two-stage generation. Stage A plans the week as concepts (cheap, sees everything at once so it can share
 * ingredients and hit budget); stage B writes each recipe in parallel. Progress is written to the plan row
 * so the UI can follow along. Locked slots are left untouched.
 */
export async function generatePlan(db: SupabaseClient, userId: string, planId: string, ctx: PlanContext) {
  const progress = (stage: string, message: string, done = 0, total = 0) =>
    db.from("meal_plans").update({ progress: { stage, message, done, total } }).eq("id", planId);

  try {
    const find = ctx.settings.plan_mode === "find";
    await progress("plan", find ? "Searching for recipes you'll love…" : "Planning your week…");
    let skeleton: Skeleton = await structured({
      model: MODELS.planner, system: CHEF_SYSTEM, schema: SkeletonSchema, effort: "medium",
      prompt: skeletonPrompt(ctx, find), webSearch: find ? 10 : undefined,
    });

    const budget = ctx.settings.weekly_budget;
    if (skeleton.est_total > budget * 1.05) {
      await progress("plan", `That came to ~$${skeleton.est_total.toFixed(0)} — trimming to fit $${budget}…`);
      skeleton = await structured({
        model: MODELS.planner, system: CHEF_SYSTEM, schema: SkeletonSchema, effort: "medium",
        prompt: `${skeletonPrompt(ctx, false)}

Your previous plan was estimated at $${skeleton.est_total.toFixed(2)}, which is over the $${budget} budget.
Revise it to fit: swap the priciest proteins for cheaper cuts or legumes, stretch with more cook-once-eat-twice,
and simplify snacks. Keep source_urls you already had. Previous plan:
${JSON.stringify(skeleton)}`,
      });
    }

    const lockedKeys = new Set(ctx.locked.map((l) => `${l.day}|${l.meal_type}`));
    const slots = skeleton.slots.filter((s) => !lockedKeys.has(`${s.day}|${s.meal_type}`));
    const used = skeleton.recipes.filter((r) => slots.some((s) => s.recipe_key === r.key));

    let done = 0;
    await progress("recipes", "Writing recipes…", 0, used.length);
    const full = await pool(used, 4, async (r) => {
      const recipe = await structured({
        model: MODELS.planner, system: CHEF_SYSTEM, schema: RecipeSchema, effort: "low",
        prompt: expandPrompt(ctx, { ...r, meal_type: r.meal_type }, skeleton.shared_staples),
        webSearch: find && r.source_url ? 2 : undefined,
      });
      await progress("recipes", `Wrote ${recipe.title}`, ++done, used.length);
      return { key: r.key, recipe };
    });

    const { data: inserted, error } = await db.from("recipes")
      .insert(full.map((f) => recipeRow(userId, f.recipe))).select("id");
    if (error) throw error;
    const idByKey = new Map(full.map((f, i) => [f.key, inserted![i].id as string]));

    // Replace every unlocked slot.
    await db.from("plan_slots").delete().eq("plan_id", planId).eq("locked", false);
    const firstSlot = new Map<string, string>();
    const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const rows = slots
      .filter((s) => idByKey.has(s.recipe_key))
      .sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day))
      .map((s) => {
        const id = crypto.randomUUID();
        const first = firstSlot.get(s.recipe_key);
        if (!first) firstSlot.set(s.recipe_key, id);
        const { serves, ids } = servesFor(s.eaters, ctx);
        return {
          id, user_id: userId, plan_id: planId, day: s.day, meal_type: s.meal_type,
          recipe_id: idByKey.get(s.recipe_key)!, servings: serves, eater_ids: ids,
          leftover_of: s.is_leftover && first ? first : null,
        };
      });
    // A model can double-book a slot; keep the first.
    const seen = new Set<string>();
    const unique = rows.filter((r) => !seen.has(`${r.day}|${r.meal_type}`) && seen.add(`${r.day}|${r.meal_type}`));
    if (unique.length) {
      const { error: slotErr } = await db.from("plan_slots").insert(unique);
      if (slotErr) throw slotErr;
    }

    await progress("shop", "Combining similar ingredients…");
    await consolidateWeek(db, userId, planId);
    await progress("shop", "Pricing your shopping list…");
    const total = await rebuildShoppingList(db, userId, planId);
    await fitBudget(db, userId, planId, ctx, skeleton.shared_staples, total, (m) => progress("shop", m));

    if (ctx.settings.prep_day) {
      await progress("prep", "Planning your prep session…");
      await generatePrep(db, userId, planId, ctx.settings);
    }

    const { data: plan } = await db.from("meal_plans").select("week_start").eq("id", planId).single();
    await scheduleReminders(db, userId, planId, plan!.week_start, ctx.settings);

    await db.from("meal_plans").update({
      status: "ready", strategy: skeleton.strategy, progress: { stage: "done", message: "Ready" },
    }).eq("id", planId);
  } catch (e) {
    console.error("generatePlan failed", e);
    await db.from("meal_plans").update({
      status: "failed", progress: { stage: "error", message: e instanceof Error ? e.message : String(e) },
    }).eq("id", planId);
  }
}
