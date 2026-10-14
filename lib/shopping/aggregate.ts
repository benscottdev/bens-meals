import type { Ingredient, Store } from "@/lib/types";

const DESCRIPTORS = /\b(fresh|large|small|medium|chopped|diced|sliced|minced|finely|roughly|grated|shredded|boneless|skinless|ripe|organic|extra|lean|raw|cooked|dried|ground|whole|of|to taste)\b/g;

/** Stable key used to merge ingredients across recipes and to remember prices. */
export function itemKey(name: string): string {
  let k = name.toLowerCase().replace(/\(.*?\)/g, "").replace(/,.*$/, "").replace(DESCRIPTORS, " ");
  k = k.replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
  // naive singular: tomatoes → tomato, onions → onion, but not "hummus"/"couscous"
  k = k
    .split(" ")
    .map((w) => (w.endsWith("oes") ? w.slice(0, -2) : w.endsWith("ies") ? w.slice(0, -3) + "y" : /[^su]s$/.test(w) ? w.slice(0, -1) : w))
    .join(" ");
  return k;
}

type Dim = "mass" | "volume" | "count";
const UNITS: Record<string, { dim: Dim; base: string; factor: number }> = {
  g: { dim: "mass", base: "g", factor: 1 },
  gram: { dim: "mass", base: "g", factor: 1 },
  kg: { dim: "mass", base: "g", factor: 1000 },
  ml: { dim: "volume", base: "ml", factor: 1 },
  l: { dim: "volume", base: "ml", factor: 1000 },
  litre: { dim: "volume", base: "ml", factor: 1000 },
  tsp: { dim: "volume", base: "ml", factor: 5 },
  teaspoon: { dim: "volume", base: "ml", factor: 5 },
  tbsp: { dim: "volume", base: "ml", factor: 20 }, // Australian tablespoon
  tablespoon: { dim: "volume", base: "ml", factor: 20 },
  cup: { dim: "volume", base: "ml", factor: 250 },
};

export function normaliseUnit(qty: number, unit: string): { qty: number; unit: string; dim: Dim } {
  const u = unit.toLowerCase().trim().replace(/\.$/, "").replace(/s$/, "");
  const def = UNITS[u];
  if (def) return { qty: qty * def.factor, unit: def.base, dim: def.dim };
  return { qty, unit: u || "each", dim: "count" };
}

/** Pretty-print a base quantity: 1500 g → 1.5 kg. */
export function prettyQty(qty: number, unit: string): string {
  const r = (n: number) => (Math.round(n * 10) / 10).toString();
  if (unit === "g" && qty >= 1000) return `${r(qty / 1000)} kg`;
  if (unit === "ml" && qty >= 1000) return `${r(qty / 1000)} L`;
  return `${r(qty)} ${unit}`;
}

export type AggregatedItem = {
  item_key: string;
  name: string;
  qty: number;
  unit: string;
  aisle: string;
  pack_hint: string | null;
  recipe_ids: string[];
};

/**
 * Merge every ingredient across recipes, scaled to how many serves are actually eaten.
 * Ingredients with incompatible units (e.g. "2 each" + "300 g" onion) become one line with the count
 * appended so nothing is lost.
 */
export function aggregate(
  uses: { recipe_id: string; scale: number; ingredients: Ingredient[] }[],
): AggregatedItem[] {
  const map = new Map<string, AggregatedItem & { extra: string[] }>();
  for (const use of uses) {
    for (const ing of use.ingredients) {
      const key = itemKey(ing.name);
      if (!key) continue;
      const n = normaliseUnit(ing.qty * use.scale, ing.unit);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          item_key: key, name: ing.name, qty: n.qty, unit: n.unit, aisle: ing.aisle,
          pack_hint: ing.pack_hint ?? null, recipe_ids: [use.recipe_id], extra: [],
        });
        continue;
      }
      if (!existing.recipe_ids.includes(use.recipe_id)) existing.recipe_ids.push(use.recipe_id);
      if (existing.unit === n.unit) existing.qty += n.qty;
      else existing.extra.push(prettyQty(n.qty, n.unit));
    }
  }
  return [...map.values()].map(({ extra, ...item }) => ({
    ...item,
    qty: Math.round(item.qty * 100) / 100,
    unit: extra.length ? `${item.unit} + ${extra.join(" + ")}` : item.unit,
  }));
}

export function storeSearchUrl(store: Store, name: string): string | null {
  const q = encodeURIComponent(name);
  switch (store) {
    case "woolworths":
      return `https://www.woolworths.com.au/shop/search/products?searchTerm=${q}`;
    case "coles":
      return `https://www.coles.com.au/search/products?q=${q}`;
    case "iga":
      return `https://www.igashop.com.au/search/1?q=${q}`;
    default:
      return null; // ALDI has no online shop
  }
}

/** Scale a recipe quantity and print it nicely: 1500 g → 1.5 kg, 0.5 cup → ½ cup. */
export function scaleQty(qty: number, unit: string, factor: number) {
  const q = qty * factor;
  if (["g", "ml"].includes(unit)) return prettyQty(Math.round(q), unit);
  const nice = Math.round(q * 4) / 4;
  const frac: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
  const whole = Math.floor(nice), part = (nice - whole).toFixed(2).replace(/0$/, "");
  return `${whole || ""}${frac[part] ?? (part !== "0.0" && part !== "0" ? part.slice(1) : "")} ${unit}`.trim();
}
