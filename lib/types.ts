export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABEL: Record<Day, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEALS)[number];
export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks",
};

export const STORES = ["woolworths", "coles", "aldi", "iga"] as const;
export type Store = (typeof STORES)[number];
export const STORE_LABEL: Record<Store, string> = {
  woolworths: "Woolworths", coles: "Coles", aldi: "ALDI", iga: "IGA",
};

export const AISLES = [
  "Fruit & Veg", "Meat & Seafood", "Deli", "Dairy, Eggs & Fridge", "Bakery", "Freezer",
  "Pantry", "Herbs & Spices", "International", "Snacks", "Drinks", "Other",
] as const;

export const DIFFICULTY_LABEL = [
  "", "Dead easy — open, heat, eat", "Easy — a bit of chopping", "Some knife work and timing",
  "Several components on the go", "Show-off — technique heavy",
];

export type Ingredient = {
  name: string;
  qty: number;
  unit: string;
  aisle: string;
  note?: string | null;
  pack_hint?: string | null;
};

export type Step = { text: string; minutes?: number | null };

export type Recipe = {
  id: string;
  title: string;
  description: string | null;
  meal_type: MealType;
  cuisine: string | null;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: number;
  meal_prep_friendly: boolean;
  freezer_friendly: boolean;
  fridge_days: number;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  est_cost: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  source: "generated" | "web" | "imported" | "manual";
  source_url: string | null;
  image_url: string | null;
};

export type Settings = {
  weekly_budget: number;
  store: Store;
  postcode: string | null;
  meal_grid: Record<Day, MealType[]>;
  leftover_nights: Day[];
  max_weeknight_minutes: number;
  max_difficulty: number;
  equipment: string[];
  cuisines: string[];
  prep_day: Day | null;
  meal_prep_lunches: boolean;
  plan_mode: "generate" | "find";
  extra_notes: string | null;
  dinner_time: string;
  timezone: string;
  onboarded: boolean;
};

export type Eater = {
  id: string;
  name: string;
  age_group: "adult" | "teen" | "child" | "toddler";
  appetite: number;
  kcal_target: number | null;
  protein_target: number | null;
  allergies: string[];
  dislikes: string[];
  diet: string | null;
  meals: MealType[];
};

export type PlanSlot = {
  id: string;
  plan_id: string;
  day: Day;
  meal_type: MealType;
  recipe_id: string | null;
  servings: number;
  eater_ids: string[];
  locked: boolean;
  skipped: boolean;
  leftover_of: string | null;
  recipe?: Recipe | null;
};

export type MealPlan = {
  id: string;
  week_start: string;
  budget: number;
  store: Store;
  status: "generating" | "ready" | "failed" | "archived";
  progress: { stage?: string; done?: number; total?: number; message?: string };
  strategy: string | null;
  est_total: number | null;
  actual_total: number | null;
};

export type ShoppingItem = {
  id: string;
  item_key: string;
  name: string;
  qty: number | null;
  unit: string | null;
  aisle: string;
  pack: string | null;
  packs: number;
  est_price: number | null;
  price_source: "estimate" | "memory" | "manual";
  checked: boolean;
  have_it: boolean;
  recipe_ids: string[];
};

/** All dates are Ben's wall clock, not the server's (Vercel runs in UTC). */
export const HOME_TZ = "Australia/Sydney";

/** Today as YYYY-MM-DD in `tz`. */
export function todayISO(tz = HOME_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Day key (mon…sun) of a YYYY-MM-DD date. */
export const dayOf = (iso: string): Day => DAYS[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];

/** Monday of the week containing `iso` (default: today at home), as YYYY-MM-DD. */
export function weekStart(iso = todayISO()): string {
  return addDays(iso, -DAYS.indexOf(dayOf(iso)));
}

export function nextWeekStart(): string {
  return addDays(weekStart(), 7);
}

export const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toFixed(2)}`;
