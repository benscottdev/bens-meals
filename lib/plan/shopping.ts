import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, structured } from "@/lib/claude/client";
import { pricePrompt } from "@/lib/claude/prompts";
import { PricingSchema } from "@/lib/claude/schemas";
import { aggregate } from "@/lib/shopping/aggregate";
import { STORE_LABEL, type Ingredient, type Store } from "@/lib/types";

type SlotRow = { recipe_id: string | null; servings: number; skipped: boolean; recipes: { servings: number; ingredients: Ingredient[] } | null };

/** Rebuilds a plan's shopping list from its slots, keeping ticks and manual prices. Returns the est. total. */
export async function rebuildShoppingList(db: SupabaseClient, userId: string, planId: string): Promise<number> {
  const [{ data: plan }, { data: slots }, { data: existing }, { data: pantry }] = await Promise.all([
    db.from("meal_plans").select("store").eq("id", planId).single(),
    db.from("plan_slots").select("recipe_id, servings, skipped, recipes(servings, ingredients)").eq("plan_id", planId),
    db.from("shopping_items").select("*").eq("plan_id", planId),
    db.from("pantry_items").select("item_key").eq("user_id", userId),
  ]);
  const store = (plan?.store ?? "woolworths") as Store;

  // serves eaten per recipe → scale factor against the serves the recipe was written for
  const eaten = new Map<string, { serves: number; recipe: NonNullable<SlotRow["recipes"]> }>();
  for (const s of (slots ?? []) as unknown as SlotRow[]) {
    if (s.skipped || !s.recipe_id || !s.recipes) continue;
    const e = eaten.get(s.recipe_id) ?? { serves: 0, recipe: s.recipes };
    e.serves += Number(s.servings);
    eaten.set(s.recipe_id, e);
  }
  const items = aggregate(
    [...eaten.entries()].map(([recipe_id, { serves, recipe }]) => ({
      recipe_id,
      scale: Math.max(0.5, Math.ceil((serves / Math.max(1, recipe.servings)) * 4) / 4),
      ingredients: recipe.ingredients,
    })),
  );

  const prev = new Map((existing ?? []).map((i) => [i.item_key, i]));
  const inPantry = new Set((pantry ?? []).map((p) => p.item_key));
  const { data: memory } = await db.from("price_memory").select("item_key, price, pack")
    .eq("user_id", userId).eq("store", store).in("item_key", items.map((i) => i.item_key));
  const remembered = new Map((memory ?? []).map((m) => [m.item_key, m]));

  const toPrice = items.filter((i) => !remembered.has(i.item_key) && prev.get(i.item_key)?.price_source !== "manual");
  const estimates = new Map<string, { pack: string; packs: number; price: number }>();
  if (toPrice.length) {
    const out = await structured({
      model: MODELS.fast,
      system: "You are an Australian grocery pricing assistant. Answer with realistic current shelf prices.",
      prompt: pricePrompt(STORE_LABEL[store], toPrice),
      schema: PricingSchema,
      maxTokens: 16000,
    });
    out.items.forEach((p) => estimates.set(p.item_key, p));
  }

  const rows = items.map((i) => {
    const old = prev.get(i.item_key);
    const mem = remembered.get(i.item_key);
    const est = estimates.get(i.item_key);
    const manual = old?.price_source === "manual";
    return {
      user_id: userId,
      plan_id: planId,
      item_key: i.item_key,
      name: i.name,
      qty: i.qty,
      unit: i.unit,
      aisle: i.aisle,
      recipe_ids: i.recipe_ids,
      pack: manual ? old.pack : mem?.pack ?? est?.pack ?? i.pack_hint,
      packs: manual ? old.packs : est?.packs ?? 1,
      est_price: manual ? old.est_price : mem ? Number(mem.price) * (est?.packs ?? 1) : est?.price ?? null,
      price_source: manual ? "manual" : mem ? "memory" : "estimate",
      checked: old?.checked ?? false,
      have_it: old?.have_it ?? inPantry.has(i.item_key),
    };
  });

  await db.from("shopping_items").delete().eq("plan_id", planId);
  if (rows.length) await db.from("shopping_items").insert(rows);
  const total = rows.reduce((t, r) => t + (r.have_it ? 0 : Number(r.est_price ?? 0)), 0);
  await db.from("meal_plans").update({ est_total: Math.round(total * 100) / 100 }).eq("id", planId);
  return total;
}
