"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MODELS, structured } from "@/lib/claude/client";
import { CHEF_SYSTEM, describeContext, swapPrompt } from "@/lib/claude/prompts";
import { IdeasSchema, RecipeSchema, SwapSchema, type RecipeOut } from "@/lib/claude/schemas";
import { loadContext } from "@/lib/plan/context";
import { recipeRow } from "@/lib/plan/generate";
import { consolidateWeek } from "@/lib/plan/optimise";
import { generatePrep } from "@/lib/plan/prep";
import { scheduleReminders } from "@/lib/plan/reminders";
import { rebuildShoppingList } from "@/lib/plan/shopping";
import { sendPush } from "@/lib/push";
import { itemKey } from "@/lib/shopping/aggregate";
import { requireUser } from "@/lib/supabase/server";
import { DAYS, MEALS, type Day, type Eater, type MealType, type Settings } from "@/lib/types";

// ------------------------------------------------------------------ settings & eaters

export async function saveSettings(patch: Partial<Settings>, finishOnboarding = false) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("settings").upsert({
    ...patch, user_id: user.id, updated_at: new Date().toISOString(),
    ...(finishOnboarding ? { onboarded: true } : {}),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  if (finishOnboarding) redirect("/");
}

export async function saveEater(e: Partial<Eater> & { name: string }) {
  const { supabase, user } = await requireUser();
  const row = { ...e, user_id: user.id };
  const { error } = e.id
    ? await supabase.from("eaters").update(row).eq("id", e.id)
    : await supabase.from("eaters").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteEater(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("eaters").delete().eq("id", id);
  revalidatePath("/settings");
}

// ------------------------------------------------------------------ plan slots

async function afterSlotChange(planId: string) {
  const { supabase, user } = await requireUser();
  await rebuildShoppingList(supabase, user.id, planId);
  revalidatePath("/plan");
  revalidatePath("/shop");
}

export async function toggleLock(slotId: string, locked: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("plan_slots").update({ locked }).eq("id", slotId);
  revalidatePath("/plan");
}

export async function toggleSkip(slotId: string, planId: string, skipped: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("plan_slots").update({ skipped }).eq("id", slotId);
  await afterSlotChange(planId);
}

export async function setSlotRecipe(planId: string, day: string, mealType: string, recipeId: string, leftoverOf: string | null = null) {
  const { supabase, user } = await requireUser();
  const ctx = await loadContext(supabase, user.id);
  const serves = ctx.eaters.filter((e) => e.meals.includes(mealType as never)).reduce((t, e) => t + Number(e.appetite), 0) || 1;
  await supabase.from("plan_slots").upsert(
    {
      user_id: user.id, plan_id: planId, day, meal_type: mealType, recipe_id: recipeId,
      servings: serves, eater_ids: ctx.eaters.map((e) => e.id), leftover_of: leftoverOf, skipped: false,
    },
    { onConflict: "plan_id,day,meal_type" },
  );
  await afterSlotChange(planId);
}

/** Cook for a different number of people: every meal this week scales, and the list is re-priced. */
export async function setWeekServings(planId: string, serves: number) {
  const { supabase } = await requireUser();
  const n = Math.max(1, Math.min(12, Math.round(serves * 2) / 2));
  const { error } = await supabase.from("plan_slots").update({ servings: n }).eq("plan_id", planId);
  if (error) throw new Error(error.message);
  await afterSlotChange(planId);
  revalidatePath("/prep");
}

/**
 * Move a meal to another day/meal. If that spot is taken the two meals swap. Leftovers are re-linked so the earliest
 * serving of a recipe is the one that gets cooked, and reminders follow the new days.
 */
export async function moveSlot(planId: string, slotId: string, toDay: string, toMeal: string) {
  const { supabase, user } = await requireUser();
  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from("plan_slots").select("*").eq("id", slotId).single(),
    supabase.from("plan_slots").select("*").eq("plan_id", planId).eq("day", toDay).eq("meal_type", toMeal).maybeSingle(),
  ]);
  if (!a) throw new Error("Meal not found");
  if (a.day === toDay && a.meal_type === toMeal) return;

  if (b) {
    // Swap what's in the two spots (rows keep their day/meal, so the unique constraint is never hit).
    const content = (s: typeof a) => ({ recipe_id: s.recipe_id, servings: s.servings, eater_ids: s.eater_ids, locked: s.locked, skipped: s.skipped, leftover_of: s.leftover_of });
    const [r1, r2] = await Promise.all([
      supabase.from("plan_slots").update(content(b)).eq("id", a.id),
      supabase.from("plan_slots").update(content(a)).eq("id", b.id),
    ]);
    if (r1.error || r2.error) throw new Error((r1.error ?? r2.error)!.message);
  } else {
    const { error } = await supabase.from("plan_slots").update({ day: toDay, meal_type: toMeal }).eq("id", a.id);
    if (error) throw new Error(error.message);
  }

  await relinkLeftovers(supabase, planId);
  const [{ data: plan }, ctx] = await Promise.all([
    supabase.from("meal_plans").select("week_start").eq("id", planId).single(),
    loadContext(supabase, user.id),
  ]);
  if (plan) await scheduleReminders(supabase, user.id, planId, plan.week_start, ctx.settings);
  revalidatePath("/plan");
  revalidatePath("/");
}

/** For recipes eaten as leftovers, make the earliest slot the cook and point the rest at it. */
async function relinkLeftovers(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], planId: string) {
  const { data: slots } = await supabase.from("plan_slots").select("id, day, meal_type, recipe_id, leftover_of, skipped").eq("plan_id", planId);
  const order = (s: { day: string; meal_type: string }) => DAYS.indexOf(s.day as Day) * 10 + MEALS.indexOf(s.meal_type as MealType);
  const withLeftovers = new Set((slots ?? []).filter((s) => s.leftover_of && s.recipe_id).map((s) => s.recipe_id!));
  const updates: PromiseLike<unknown>[] = [];
  for (const rid of withLeftovers) {
    const group = (slots ?? []).filter((s) => s.recipe_id === rid && !s.skipped).sort((x, y) => order(x) - order(y));
    group.forEach((s, i) => {
      const want = i === 0 ? null : group[0].id;
      if (s.leftover_of !== want) updates.push(supabase.from("plan_slots").update({ leftover_of: want }).eq("id", s.id));
    });
  }
  await Promise.all(updates);
}

export async function clearSlot(slotId: string, planId: string) {
  const { supabase } = await requireUser();
  await supabase.from("plan_slots").delete().eq("id", slotId);
  await afterSlotChange(planId);
}

/** Three Claude-suggested alternatives for a slot. Nothing is saved until one is picked. */
export async function suggestSwaps(slotId: string): Promise<{ why: string; recipe: RecipeOut }[]> {
  const { supabase, user } = await requireUser();
  const { data: slot } = await supabase.from("plan_slots")
    .select("plan_id, day, meal_type, servings, recipes(title), meal_plans(budget, est_total)").eq("id", slotId).single();
  if (!slot) throw new Error("Slot not found");
  const [ctx, { data: list }] = await Promise.all([
    loadContext(supabase, user.id, slot.plan_id),
    supabase.from("shopping_items").select("name").eq("plan_id", slot.plan_id),
  ]);
  const plan = slot.meal_plans as unknown as { budget: number; est_total: number | null };
  const out = await structured({
    model: MODELS.planner, system: CHEF_SYSTEM, schema: SwapSchema, effort: "low",
    prompt: swapPrompt(
      ctx,
      { day: slot.day, meal_type: slot.meal_type, servings: Number(slot.servings), current: (slot.recipes as unknown as { title: string } | null)?.title ?? "nothing yet" },
      (list ?? []).map((l) => l.name),
      Number(plan.budget) - Number(plan.est_total ?? 0),
    ),
  });
  return out.options.slice(0, 3);
}

export async function applySwap(slotId: string, recipe: RecipeOut) {
  const { supabase, user } = await requireUser();
  const parsed = RecipeSchema.parse(recipe);
  const { data: inserted, error } = await supabase.from("recipes").insert(recipeRow(user.id, parsed)).select("id").single();
  if (error) throw new Error(error.message);
  const { data: slot } = await supabase.from("plan_slots").update({ recipe_id: inserted.id, leftover_of: null })
    .eq("id", slotId).select("plan_id").single();
  // Leftover slots of the old recipe follow the swap.
  await supabase.from("plan_slots").update({ recipe_id: inserted.id }).eq("leftover_of", slotId);
  await afterSlotChange(slot!.plan_id);
  return inserted.id as string;
}

// ------------------------------------------------------------------ recipes

export async function setFeedback(recipeId: string, patch: { favourite?: boolean; rating?: number | null; never_again?: boolean; notes?: string; cooked?: boolean }) {
  const { supabase, user } = await requireUser();
  const { data: cur } = await supabase.from("recipe_feedback").select("*").eq("recipe_id", recipeId).maybeSingle();
  const { cooked, ...rest } = patch;
  await supabase.from("recipe_feedback").upsert({
    recipe_id: recipeId, user_id: user.id, ...rest,
    ...(cooked ? { cooked_count: (cur?.cooked_count ?? 0) + 1, last_cooked: new Date().toISOString().slice(0, 10) } : {}),
    updated_at: new Date().toISOString(),
  });
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}

export async function deleteRecipe(recipeId: string) {
  const { supabase } = await requireUser();
  await supabase.from("recipes").delete().eq("id", recipeId);
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function saveRecipes(recipes: RecipeOut[], source: "imported" | "generated" = "generated") {
  const { supabase, user } = await requireUser();
  const rows = recipes.map((r) => ({ ...recipeRow(user.id, RecipeSchema.parse(r)), ...(source === "imported" ? { source } : {}) }));
  const { data, error } = await supabase.from("recipes").insert(rows).select("id");
  if (error) throw new Error(error.message);
  revalidatePath("/recipes");
  return (data ?? []).map((d) => d.id as string);
}

/** Paste a link or snap a cookbook page → structured recipe (not saved yet). */
export async function importRecipe(input: { url?: string; image?: { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } }) {
  const { supabase, user } = await requireUser();
  const ctx = await loadContext(supabase, user.id);
  return structured({
    model: MODELS.planner, system: CHEF_SYSTEM, schema: RecipeSchema, effort: "low",
    images: input.image ? [input.image] : undefined,
    webSearch: input.url ? 3 : undefined,
    prompt: input.url
      ? `Find and read the recipe at ${input.url} and transcribe it faithfully (convert to metric, Australian names). Set source_url to that URL. Estimate macros/cost if missing. Servings as written. Context for aisles/pricing:\n${describeContext(ctx).split("\n")[0]}`
      : "Transcribe the recipe in this photo faithfully (metric, Australian ingredient names). Estimate macros/cost/difficulty. source_url null.",
  });
}

/** "What can I make with…" — ideas that use up what's in the fridge. */
export async function fridgeRescue(have: string, mealType: string) {
  const { supabase, user } = await requireUser();
  const ctx = await loadContext(supabase, user.id);
  const out = await structured({
    model: MODELS.planner, system: CHEF_SYSTEM, schema: IdeasSchema, effort: "low",
    prompt: `${describeContext(ctx)}\n\nBen needs to use up: ${have}.\nGive 3 ${mealType} recipes that use as much of that as possible plus pantry basics, with minimal extra shopping. Servings for everyone eating.`,
  });
  return out.recipes.slice(0, 3);
}

// ------------------------------------------------------------------ shopping & pantry

export async function toggleItem(id: string, field: "checked" | "have_it", value: boolean) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("shopping_items").update({ [field]: value }).eq("id", id).select("*").single();
  if (field === "have_it" && item) {
    if (value) {
      await supabase.from("pantry_items").upsert({ user_id: user.id, item_key: item.item_key, name: item.name, qty: item.qty, unit: item.unit }, { onConflict: "user_id,item_key" });
    } else {
      // Un-marking means it's run out — forget it (staples like salt stay).
      await supabase.from("pantry_items").delete().eq("user_id", user.id).eq("item_key", item.item_key).eq("is_staple", false);
    }
    const { data: all } = await supabase.from("shopping_items").select("est_price, have_it").eq("plan_id", item.plan_id);
    const total = (all ?? []).reduce((t, r) => t + (r.have_it ? 0 : Number(r.est_price ?? 0)), 0);
    await supabase.from("meal_plans").update({ est_total: Math.round(total * 100) / 100 }).eq("id", item.plan_id);
  }
  revalidatePath("/shop");
  revalidatePath("/plan");
}

/** Correct a price; it's remembered for this store next time. */
export async function setItemPrice(id: string, price: number, pack: string | null) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("shopping_items")
    .update({ est_price: price, pack, price_source: "manual" }).eq("id", id).select("plan_id, item_key, packs, meal_plans(store)").single();
  if (!item) return;
  const store = (item.meal_plans as unknown as { store: string }).store;
  await supabase.from("price_memory").upsert({
    user_id: user.id, store, item_key: item.item_key, price: price / Math.max(1, item.packs), pack, updated_at: new Date().toISOString(),
  });
  const { data: all } = await supabase.from("shopping_items").select("est_price, have_it").eq("plan_id", item.plan_id);
  const total = (all ?? []).reduce((t, r) => t + (r.have_it ? 0 : Number(r.est_price ?? 0)), 0);
  await supabase.from("meal_plans").update({ est_total: Math.round(total * 100) / 100 }).eq("id", item.plan_id);
  revalidatePath("/shop");
}

/** Merge near-duplicate products across this week's recipes (two oils, three rices…) and re-price the list. */
export async function optimiseList(planId: string) {
  const { supabase, user } = await requireUser();
  const merges = await consolidateWeek(supabase, user.id, planId);
  const total = await rebuildShoppingList(supabase, user.id, planId);
  revalidatePath("/shop");
  revalidatePath("/plan");
  return { merges: merges.map((m) => `${m.from.join(" + ")} → ${m.to}`), total };
}

export async function addExtraItem(planId: string, name: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("shopping_items").upsert(
    { user_id: user.id, plan_id: planId, item_key: itemKey(name) || name.toLowerCase(), name, aisle: "Other", price_source: "manual" },
    { onConflict: "plan_id,item_key" },
  );
  revalidatePath("/shop");
}

export async function setActualTotal(planId: string, total: number | null) {
  const { supabase } = await requireUser();
  await supabase.from("meal_plans").update({ actual_total: total }).eq("id", planId);
  revalidatePath("/shop");
  revalidatePath("/settings/stats");
}

export async function savePantryItem(name: string, isStaple: boolean) {
  const { supabase, user } = await requireUser();
  await supabase.from("pantry_items").upsert(
    { user_id: user.id, item_key: itemKey(name) || name.toLowerCase(), name, is_staple: isStaple, updated_at: new Date().toISOString() },
    { onConflict: "user_id,item_key" },
  );
  revalidatePath("/pantry");
}

export async function removePantryItem(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("pantry_items").delete().eq("id", id);
  revalidatePath("/pantry");
}

// ------------------------------------------------------------------ saved weeks

type SavedSlot = {
  day: string; meal_type: string; recipe_id: string; servings: number;
  eater_ids: string[]; skipped: boolean; locked: boolean; leftover_of: string | null;
};

/** Snapshot a planned week (meals + prep) under a name; optionally favourite every recipe in it. */
export async function saveWeek(planId: string, name: string, favouriteAll: boolean) {
  const { supabase, user } = await requireUser();
  const [{ data: plan }, { data: slots }, { data: prep }] = await Promise.all([
    supabase.from("meal_plans").select("budget, est_total, strategy").eq("id", planId).single(),
    supabase.from("plan_slots").select("id, day, meal_type, recipe_id, servings, eater_ids, skipped, locked, leftover_of").eq("plan_id", planId),
    supabase.from("prep_sessions").select("timeline").eq("plan_id", planId).maybeSingle(),
  ]);
  if (!plan) throw new Error("Week not found");
  const rows = (slots ?? []).filter((s) => s.recipe_id);
  const keyOf = new Map(rows.map((s) => [s.id, `${s.day}|${s.meal_type}`]));
  const snapshot: SavedSlot[] = rows.map((s) => ({
    day: s.day, meal_type: s.meal_type, recipe_id: s.recipe_id!, servings: Number(s.servings),
    eater_ids: s.eater_ids, skipped: s.skipped, locked: s.locked, leftover_of: s.leftover_of ? keyOf.get(s.leftover_of) ?? null : null,
  }));
  const { error } = await supabase.from("saved_weeks").insert({
    user_id: user.id, name: name.trim() || "Saved week", budget: plan.budget, est_total: plan.est_total,
    strategy: plan.strategy, slots: snapshot, prep_timeline: prep?.timeline ?? null,
  });
  if (error) throw new Error(error.message.includes("saved_weeks") ? "Run the saved-weeks SQL in Supabase first." : error.message);

  if (favouriteAll) {
    const ids = [...new Set(snapshot.map((s) => s.recipe_id))];
    const { data: existing } = await supabase.from("recipe_feedback").select("recipe_id").in("recipe_id", ids);
    const have = new Set((existing ?? []).map((e) => e.recipe_id));
    if (have.size) await supabase.from("recipe_feedback").update({ favourite: true, never_again: false }).in("recipe_id", [...have]);
    const fresh = ids.filter((id) => !have.has(id)).map((recipe_id) => ({ recipe_id, user_id: user.id, favourite: true }));
    if (fresh.length) await supabase.from("recipe_feedback").insert(fresh);
  }
  revalidatePath("/plan");
  revalidatePath("/recipes");
}

/** Replace a week's meals with a saved week, then rebuild its list, prep and reminders. */
export async function loadSavedWeek(savedId: string, weekStart: string) {
  const { supabase, user } = await requireUser();
  const [{ data: saved }, ctx] = await Promise.all([
    supabase.from("saved_weeks").select("*").eq("id", savedId).single(),
    loadContext(supabase, user.id),
  ]);
  if (!saved) throw new Error("Saved week not found");

  let { data: plan } = await supabase.from("meal_plans").select("id, status")
    .eq("user_id", user.id).eq("week_start", weekStart).neq("status", "archived").maybeSingle();
  if (plan?.status === "generating") throw new Error("This week is still being planned — try again in a minute.");
  const fields = {
    status: "ready", budget: ctx.settings.weekly_budget, store: ctx.settings.store, strategy: saved.strategy,
    settings_snapshot: ctx.settings, progress: { stage: "done", message: `Loaded “${saved.name}”` },
  };
  if (plan) {
    await supabase.from("meal_plans").update(fields).eq("id", plan.id);
  } else {
    const { data, error } = await supabase.from("meal_plans").insert({ ...fields, user_id: user.id, week_start: weekStart }).select("id, status").single();
    if (error) throw new Error(error.message);
    plan = data;
  }
  const planId = plan!.id as string;

  // Only recipes that still exist come back.
  const slots = saved.slots as SavedSlot[];
  const { data: alive } = await supabase.from("recipes").select("id").in("id", [...new Set(slots.map((s) => s.recipe_id))]);
  const ok = new Set((alive ?? []).map((r) => r.id));
  const idOf = new Map<string, string>();
  const rows = slots.filter((s) => ok.has(s.recipe_id)).map((s) => {
    const id = crypto.randomUUID();
    idOf.set(`${s.day}|${s.meal_type}`, id);
    return { ...s, id };
  }).map(({ leftover_of, ...s }) => ({
    ...s, user_id: user.id, plan_id: planId, leftover_of: leftover_of ? idOf.get(leftover_of) ?? null : null,
  }));

  await supabase.from("plan_slots").delete().eq("plan_id", planId);
  // Insert originals before leftovers so the self-reference exists.
  const firsts = rows.filter((r) => !r.leftover_of), rest = rows.filter((r) => r.leftover_of);
  for (const batch of [firsts, rest]) {
    if (!batch.length) continue;
    const { error } = await supabase.from("plan_slots").insert(batch);
    if (error) throw new Error(error.message);
  }

  await supabase.from("prep_sessions").delete().eq("plan_id", planId);
  if (saved.prep_timeline && ctx.settings.prep_day) {
    await supabase.from("prep_sessions").insert({ user_id: user.id, plan_id: planId, day: ctx.settings.prep_day, timeline: saved.prep_timeline });
  }
  await rebuildShoppingList(supabase, user.id, planId);
  await scheduleReminders(supabase, user.id, planId, weekStart, ctx.settings);
  revalidatePath("/plan");
  revalidatePath("/shop");
  revalidatePath("/prep");
  return { missing: slots.length - rows.length };
}

export async function deleteSavedWeek(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("saved_weeks").delete().eq("id", id);
  revalidatePath("/plan");
}

// ------------------------------------------------------------------ share links

export type ShareLink = { token: string; include_list: boolean };

/** Get (or make) the live read-only link for a week or a recipe. Reuses an existing link so the URL stays stable. */
export async function getShareLink(target: { planId?: string; recipeId?: string }): Promise<ShareLink> {
  const { supabase, user } = await requireUser();
  const col = target.planId ? "plan_id" : "recipe_id";
  const id = target.planId ?? target.recipeId;
  if (!id) throw new Error("Nothing to share");
  const { data: existing, error: readErr } = await supabase.from("share_links").select("token, include_list")
    .eq(col, id).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (readErr) throw new Error(readErr.message.includes("share_links") ? "Run the share-links SQL in Supabase first." : readErr.message);
  if (existing) return existing;
  const { data, error } = await supabase.from("share_links").insert({ user_id: user.id, [col]: id }).select("token, include_list").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setShareIncludesList(token: string, include: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("share_links").update({ include_list: include }).eq("token", token);
}

/** Turn a link off for good. Sharing again makes a new URL. */
export async function revokeShareLink(token: string) {
  const { supabase } = await requireUser();
  await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("token", token);
}

// ------------------------------------------------------------------ prep, reminders, push

export async function regeneratePrep(planId: string) {
  const { supabase, user } = await requireUser();
  const ctx = await loadContext(supabase, user.id);
  const ok = await generatePrep(supabase, user.id, planId, ctx.settings);
  revalidatePath("/prep");
  return ok;
}

export async function refreshReminders(planId: string) {
  const { supabase, user } = await requireUser();
  const [{ data: plan }, ctx] = await Promise.all([
    supabase.from("meal_plans").select("week_start").eq("id", planId).single(),
    loadContext(supabase, user.id),
  ]);
  await scheduleReminders(supabase, user.id, planId, plan!.week_start, ctx.settings);
}

export async function sendToPhone(title: string, url: string, body?: string) {
  const { supabase, user } = await requireUser();
  return sendPush(supabase, user.id, { title, url, body: body ?? "Tap to open", tag: url });
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, label: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device_label: label },
    { onConflict: "endpoint" },
  );
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
