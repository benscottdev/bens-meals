import { describe, expect, it } from "vitest";
import { aggregate, itemKey, normaliseUnit, prettyQty } from "./aggregate";

describe("itemKey", () => {
  it("merges descriptors and plurals", () => {
    expect(itemKey("Brown onions, finely diced")).toBe("brown onion");
    expect(itemKey("brown onion")).toBe("brown onion");
    expect(itemKey("Cherry tomatoes")).toBe("cherry tomato");
    expect(itemKey("Fresh coriander (1 bunch)")).toBe("coriander");
    expect(itemKey("Hummus")).toBe("hummus");
    expect(itemKey("Berries")).toBe("berry");
  });
});

describe("normaliseUnit", () => {
  it("converts to base units with Australian tablespoons", () => {
    expect(normaliseUnit(1.5, "kg")).toEqual({ qty: 1500, unit: "g", dim: "mass" });
    expect(normaliseUnit(2, "tbsp")).toEqual({ qty: 40, unit: "ml", dim: "volume" });
    expect(normaliseUnit(3, "Cloves")).toEqual({ qty: 3, unit: "clove", dim: "count" });
  });
});

describe("aggregate", () => {
  it("sums across recipes and scales by serves eaten", () => {
    const out = aggregate([
      { recipe_id: "a", scale: 1, ingredients: [{ name: "Chicken thigh fillets", qty: 500, unit: "g", aisle: "Meat & Seafood" }] },
      { recipe_id: "b", scale: 2, ingredients: [{ name: "chicken thigh fillet", qty: 0.25, unit: "kg", aisle: "Meat & Seafood" }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ item_key: "chicken thigh fillet", qty: 1000, unit: "g", recipe_ids: ["a", "b"] });
  });

  it("keeps incompatible units instead of dropping them", () => {
    const out = aggregate([
      { recipe_id: "a", scale: 1, ingredients: [{ name: "Brown onion", qty: 1, unit: "each", aisle: "Fruit & Veg" }] },
      { recipe_id: "b", scale: 1, ingredients: [{ name: "brown onions", qty: 150, unit: "g", aisle: "Fruit & Veg" }] },
    ]);
    expect(out[0].unit).toBe("each + 150 g");
  });
});

it("prettyQty", () => {
  expect(prettyQty(1500, "g")).toBe("1.5 kg");
  expect(prettyQty(250, "ml")).toBe("250 ml");
});
