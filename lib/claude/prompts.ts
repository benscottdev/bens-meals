import { DAY_LABEL, DAYS, MEAL_LABEL, STORE_LABEL, type Eater, type Settings } from "@/lib/types";

export type PlanContext = {
  settings: Settings;
  eaters: Eater[];
  favourites: string[];
  neverAgain: string[];
  recent: string[];
  pantry: string[];
  locked: { day: string; meal_type: string; title: string }[];
};

export const CHEF_SYSTEM = `You are the meal planner inside "Ben's Meals", an Australian home-cooking app.
Your job is to take the mental load off cooking and grocery shopping.

House rules:
- Australian supermarkets, AUD, metric, Australian ingredient names (capsicum, coriander, mince, spring onion).
- Allergies are absolute: never include an allergen or anything commonly containing it.
- Dislikes are strong preferences: avoid unless unavoidable.
- Respect each eater's diet, calorie and protein targets across the day.
- Be budget-smart: reuse perishable ingredients across meals so nothing is wasted, favour seasonal produce and
  supermarket staples, and use cook-once-eat-twice for leftover nights and lunches.
- One of each staple per week: a single cooking oil, a single rice, a single onion, a single stock, a single pasta
  shape, a single cheese, and so on. Never make Ben buy two oils or three rices. Only keep a second variety when the dish
  genuinely fails without it (e.g. arborio for risotto, sesame oil as a flavouring) — and then make another recipe use it too.
- Keep weeknight dinners within the time limit and every recipe within the difficulty ceiling.
- Recipes must be genuinely good: real techniques, seasoning, and clear numbered steps a tired person can follow.`;

export function describeContext(c: PlanContext): string {
  const s = c.settings;
  const grid = DAYS.map((d) => `  ${DAY_LABEL[d]}: ${(s.meal_grid[d] ?? []).map((m) => MEAL_LABEL[m]).join(", ") || "nothing"}`).join("\n");
  const eaters = c.eaters.length
    ? c.eaters
        .map((e) =>
          [
            `- ${e.name} (${e.age_group}, appetite x${e.appetite})`,
            e.diet && `diet: ${e.diet}`,
            e.kcal_target && `${e.kcal_target} kcal/day`,
            e.protein_target && `${e.protein_target}g protein/day`,
            e.allergies.length && `ALLERGIES: ${e.allergies.join(", ")}`,
            e.dislikes.length && `dislikes: ${e.dislikes.join(", ")}`,
            e.meals.length < 4 && `only eats: ${e.meals.join(", ")}`,
          ]
            .filter(Boolean)
            .join("; "),
        )
        .join("\n")
    : "- One adult, no restrictions";

  return `STORE: ${STORE_LABEL[s.store]}${s.postcode ? ` (postcode ${s.postcode})` : ""}
WEEKLY BUDGET: $${s.weekly_budget} AUD for the whole shop
MEALS NEEDED:
${grid}
LEFTOVER NIGHTS (dinner = leftovers of an earlier dinner): ${s.leftover_nights.map((d) => DAY_LABEL[d]).join(", ") || "none"}
MAX WEEKNIGHT COOK TIME: ${s.max_weeknight_minutes} min total (prep + cook)
DIFFICULTY CEILING: ${s.max_difficulty}/5
EQUIPMENT: ${s.equipment.join(", ") || "basic kitchen"}
CUISINES LIKED: ${s.cuisines.join(", ") || "anything"}
${s.prep_day ? `MEAL PREP: big prep session on ${DAY_LABEL[s.prep_day]}${s.meal_prep_lunches ? "; weekday lunches should be prep-friendly batch meals" : ""}` : "MEAL PREP: none"}
EATERS:
${eaters}
FAVOURITES (welcome to repeat ~1 per week): ${c.favourites.join("; ") || "none yet"}
NEVER SUGGEST: ${c.neverAgain.join("; ") || "-"}
COOKED IN LAST 3 WEEKS (avoid repeating): ${c.recent.join("; ") || "-"}
ALREADY IN PANTRY (don't need buying): ${c.pantry.join(", ") || "salt, pepper, olive oil"}
${c.locked.length ? `LOCKED SLOTS (keep exactly, plan around them):\n${c.locked.map((l) => `  ${l.day} ${l.meal_type}: ${l.title}`).join("\n")}` : ""}
${s.extra_notes ? `NOTES FROM BEN: ${s.extra_notes}` : ""}`;
}

export function skeletonPrompt(c: PlanContext, find: boolean) {
  return `${describeContext(c)}

Plan the week. Fill every needed slot that is not locked. A recipe may cover several slots (leftovers,
batch lunches, a snack eaten across days) — list it once in "recipes" with total servings, then
reference it from each slot. Slots for a recipe must not come before the day it is first cooked unless prepped
on the prep day. Snacks can be simple (fruit + yoghurt, a batch of bliss balls).
Keep the estimated whole-pack shop at or under budget.
${find ? "Use web search to base each main recipe on a real, well-reviewed recipe (taste.com.au, RecipeTin Eats, BBC Good Food, etc.) and give its source_url." : "Create original recipes; source_url null."}`;
}

export function expandPrompt(
  c: PlanContext,
  r: { title: string; brief: string; servings: number; meal_type: string; source_url: string | null },
  staples: string[] = [],
) {
  return `${describeContext(c)}
${staples.length ? `\nTHIS WEEK'S SHARED STAPLES — use these exact names and no other variety of them (no other oil, rice, onion, stock…): ${staples.join(", ")}\n` : ""}
Write the full recipe for "${r.title}" (${r.meal_type}) — ${r.brief}.
Cook ${r.servings} serves total. Quantities are for all ${r.servings} serves; macros are per serve.
${r.source_url ? `Base it on ${r.source_url} (adapt to the constraints above) and keep that source_url.` : "source_url: null."}`;
}

export function swapPrompt(
  c: PlanContext,
  slot: { day: string; meal_type: string; current: string; servings: number },
  shoppingList: string[],
  remainingBudget: number,
) {
  return `${describeContext(c)}

Ben wants to swap ${slot.day} ${slot.meal_type}: "${slot.current}". Suggest 3 different alternatives for ${slot.servings} serves.
Prefer ingredients already on this week's list: ${shoppingList.join(", ")}.
Use the exact same staples already on that list (same oil, rice, onion, stock, pasta, cheese) — never add another variety.
Roughly $${remainingBudget.toFixed(0)} of budget headroom. Make the three options feel distinct (e.g. quickest, cheapest, most protein).`;
}

export function pricePrompt(store: string, items: { item_key: string; name: string; qty: number | null; unit: string | null; pack_hint: string | null }[]) {
  return `Estimate current ${store} (Australia) shelf prices for this shopping list. For each item choose a realistic
pack size that covers the quantity needed (whole packs only), how many packs, and the total AUD.
Use typical non-special prices; home-brand where it's the sensible choice.

${items.map((i) => `- ${i.item_key}: need ${i.qty ?? ""} ${i.unit ?? ""}${i.pack_hint ? ` (usual pack ${i.pack_hint})` : ""}`).join("\n")}`;
}

export function prepPrompt(recipes: { title: string; ingredients: string; steps: string }[], prepDay: string, eatDays: Record<string, string[]>) {
  return `Make a single combined meal-prep session plan for ${prepDay}. Batch shared tasks (chop all onions once,
get the oven/rice going first), and order steps by minute offset so nothing sits idle. Then say where each
dish is stored and by when it must be eaten — use the freezer for anything eaten past its fridge life.

When each dish is eaten: ${JSON.stringify(eatDays)}

${recipes.map((r) => `## ${r.title}\nIngredients: ${r.ingredients}\nSteps: ${r.steps}`).join("\n\n")}`;
}

export function consolidatePrompt(recipes: { title: string; ingredients: string[] }[], pantry: string[]) {
  return `Ben is buying ingredients for these recipes this week. Find ingredients that are needlessly different
products and should be bought as ONE product to save money and waste: e.g. olive oil + vegetable oil + canola oil → olive oil;
basmati + jasmine + long-grain rice → jasmine rice; white onion + brown onion → brown onion; diced + crushed tinned tomatoes →
diced tinned tomatoes; cheddar + tasty cheese → tasty cheese; spaghetti + linguine → spaghetti; chicken + vegetable stock → one
(unless a vegetarian dish needs vegetable).

Do NOT merge when it would genuinely spoil a dish (arborio for risotto, sushi rice, sesame oil used for flavour, buttermilk for
pancakes, fresh vs dried herbs that behave differently) or break a diet/allergy. Prefer the version Ben already owns: ${pantry.join(", ") || "nothing listed"}.
Only list real merges; return an empty list if everything is already consolidated.

${recipes.map((r) => `## ${r.title}\n${r.ingredients.join("\n")}`).join("\n\n")}`;
}

export function repairPrompt(
  c: PlanContext,
  total: number,
  recipes: { title: string; cost: number; meals: number; locked: boolean }[],
  list: { name: string; price: number }[],
) {
  return `${describeContext(c)}

The priced shopping list for this week comes to $${total.toFixed(2)}, which is $${(total - c.settings.weekly_budget).toFixed(2)} over budget.

Recipes with the share of the shop each one causes (whole packs, split across the recipes that use them):
${recipes.map((r) => `- ${r.title}: ~$${r.cost.toFixed(2)} across ${r.meals} meal(s)${r.locked ? " (LOCKED — do not replace)" : ""}`).join("\n")}

Current list: ${list.map((l) => `${l.name} $${l.price.toFixed(2)}`).join("; ")}

Replace the fewest recipes (max 3, never locked ones) needed to get under budget. Replacements must be the same meal type, reuse
ingredients already on the list wherever possible (they're already paid for), and use cheaper proteins (thighs, mince, eggs,
legumes, tinned fish). Prefer replacing recipes that need ingredients nothing else uses.`;
}
