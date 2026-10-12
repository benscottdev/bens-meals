// Development-only design preview with sample data (no sign-in needed). 404s in production.
import { notFound } from "next/navigation";
import { Dashboard } from "@/components/home/Dashboard";
import { PageSkeleton } from "@/components/kitchen/Skeleton";
import { PageTitle } from "@/components/kitchen/ui";
import { WeekPlanner } from "@/components/plan/WeekPlanner";
import { RecipeView } from "@/components/recipes/RecipeView";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { ShoppingList } from "@/components/shop/ShoppingList";
import { DEFAULT_SETTINGS } from "@/lib/plan/context";
import type { MealPlan, PlanSlot, Recipe, ShoppingItem } from "@/lib/types";

const recipe = (id: string, title: string, meal: Recipe["meal_type"], mins: number, diff: number, kcal: number, protein: number): Recipe => ({
  id, title, description: "Sticky, savoury and on the table fast — a weeknight staple.", meal_type: meal, cuisine: "Japanese",
  servings: 2, prep_minutes: 10, cook_minutes: mins - 10, difficulty: diff, meal_prep_friendly: diff < 3, freezer_friendly: false,
  fridge_days: 3, kcal, protein_g: protein, carbs_g: 48, fat_g: 18, est_cost: 14.2, tags: ["high-protein", "one-pan"],
  source: "generated", source_url: null, image_url: null,
  ingredients: [
    { name: "Salmon fillets", qty: 400, unit: "g", aisle: "Meat & Seafood", note: "skin on" },
    { name: "White miso paste", qty: 2, unit: "tbsp", aisle: "International" },
    { name: "Jasmine rice", qty: 1, unit: "cup", aisle: "Pantry" },
    { name: "Broccolini", qty: 1, unit: "bunch", aisle: "Fruit & Veg", note: "trimmed" },
  ],
  steps: [
    { text: "Heat the oven grill to high and line a tray with foil." },
    { text: "Mix the miso with honey and soy, then brush over the salmon.", minutes: null },
    { text: "Grill the salmon until caramelised and just cooked through.", minutes: 8 },
    { text: "Serve with rice and steamed broccolini." },
  ],
});

const recipes = [
  recipe("r1", "Miso-glazed salmon with broccolini", "dinner", 25, 2, 620, 42),
  recipe("r2", "Overnight oats with berries", "breakfast", 5, 1, 380, 18),
  recipe("r3", "Lamb kofta bowls with tzatziki", "dinner", 35, 3, 710, 45),
  recipe("r4", "Chicken, avocado & quinoa salad", "lunch", 20, 2, 540, 38),
];
const plan: MealPlan = {
  id: "00000000-0000-0000-0000-000000000000", week_start: "2026-10-05", budget: 120, store: "woolworths", status: "ready",
  progress: {}, est_total: 112.4, actual_total: null,
  strategy: "Coriander, spinach and Greek yoghurt carry across four meals so nothing wilts. Tuesday and Thursday dinners are cook-once-eat-twice, and lunches are batch-cooked on Sunday.",
};
const slot = (i: number, day: PlanSlot["day"], meal: PlanSlot["meal_type"], r: Recipe, extra: Partial<PlanSlot> = {}): PlanSlot =>
  ({ id: `s${i}`, plan_id: plan.id, day, meal_type: meal, recipe_id: r.id, servings: 2, eater_ids: [], locked: false, skipped: false, leftover_of: null, recipe: r, ...extra });
const slots = [
  slot(1, "mon", "breakfast", recipes[1]), slot(2, "mon", "lunch", recipes[3]), slot(3, "mon", "dinner", recipes[0], { locked: true }),
  slot(4, "tue", "breakfast", recipes[1]), slot(5, "tue", "lunch", recipes[3]), slot(6, "tue", "dinner", recipes[2]),
  slot(7, "wed", "breakfast", recipes[1]), slot(8, "wed", "lunch", recipes[3]), slot(9, "wed", "dinner", recipes[2], { leftover_of: "s6" }),
];
const items: ShoppingItem[] = [
  ["Salmon fillets", "Meat & Seafood", "400g pack", 15.5], ["Lamb mince", "Meat & Seafood", "500g tray", 11], ["Broccolini", "Fruit & Veg", "bunch", 3.5],
  ["Baby spinach", "Fruit & Veg", "120g bag", 3], ["Greek yoghurt", "Dairy, Eggs & Fridge", "1kg tub", 6.5], ["Rolled oats", "Pantry", "750g bag", 2.6],
].map(([name, aisle, pack, price], i) => ({
  id: `i${i}`, item_key: String(name).toLowerCase(), name: String(name), qty: 1, unit: "each", aisle: String(aisle), pack: String(pack), packs: 1,
  est_price: Number(price), price_source: "estimate", checked: i === 2, have_it: false, recipe_ids: [],
}));

export default async function Dev({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const s = (await searchParams).s ?? "plan";
  const settings = { ...DEFAULT_SETTINGS, weekly_budget: 120, onboarded: true };
  if (s === "home") return (
    <Dashboard settings={settings} today="2026-10-06" nowMins={16 * 60 + 40} plan={plan} slots={slots} nextPlanned={false} hasPrep
      shopping={items.map((i) => ({ checked: i.checked, have_it: i.have_it }))}
      recent={[{ week_start: "2026-09-28", budget: 120, est_total: 118.3, actual_total: 124.1 }, { week_start: "2026-09-21", budget: 120, est_total: 109.9, actual_total: null }]}
      reminders={[{ id: "a", title: "Start dinner: Lamb kofta bowls", fire_at: "2026-10-06T07:00:00Z", url: "/plan" }, { id: "b", title: "Defrost the lamb mince", fire_at: "2026-10-07T09:00:00Z", url: "/plan" }]}
    />
  );
  if (s === "loading") return <PageSkeleton title="This week" variant="week" />;
  if (s === "recipe") return <RecipeView r={recipes[0]} fb={null} />;
  if (s === "shop") return (<><PageTitle sub="Week of 5 October">Shopping</PageTitle><ShoppingList plan={plan} items={items} /></>);
  if (s === "settings") return (<><PageTitle sub="Preferences">Settings</PageTitle><SettingsForm initial={settings} /></>);
  if (s === "empty") return (<><PageTitle sub="Week of 12 October · Woolworths">Next week</PageTitle><WeekPlanner weekStart="2026-10-12" plan={null} slots={[]} settings={settings} favourites={[]} savedWeeks={[]} /></>);
  return (<><PageTitle sub="Week of 5 October · Woolworths">This week</PageTitle><WeekPlanner weekStart="2026-10-05" plan={plan} slots={slots} settings={settings} favourites={recipes} savedWeeks={[{ id: "w1", name: "Week of 28 Sep", created_at: "2026-09-28T00:00:00Z", est_total: 108.2, meals: 21 }]} /></>);
}
