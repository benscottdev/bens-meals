import { z } from "zod";
import { AISLES, DAYS, MEALS } from "@/lib/types";

export const IngredientSchema = z.object({
  name: z.string().describe("Plain supermarket name, e.g. 'chicken thigh fillets', 'brown onion'"),
  qty: z.number().describe("Amount for the whole recipe at the stated servings"),
  unit: z.string().describe("g, kg, ml, l, tsp, tbsp, cup, or a count word: each, clove, can, bunch, packet, slice"),
  aisle: z.enum(AISLES),
  note: z.string().nullable().describe("Prep note, e.g. 'finely diced'"),
  pack_hint: z.string().nullable().describe("Typical Australian pack, e.g. '500g tray', '400g can'"),
});

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string().describe("One appetising sentence"),
  meal_type: z.enum(MEALS),
  cuisine: z.string(),
  servings: z.number().int(),
  prep_minutes: z.number().int(),
  cook_minutes: z.number().int(),
  difficulty: z.number().int().describe("1 = assemble/heat, 2 = easy chopping, 3 = some technique/timing, 4 = several components, 5 = advanced technique"),
  meal_prep_friendly: z.boolean().describe("Holds well in containers for 3+ days"),
  freezer_friendly: z.boolean(),
  fridge_days: z.number().int().describe("Days it keeps cooked in the fridge"),
  kcal: z.number().int().describe("Per serve"),
  protein_g: z.number().int().describe("Per serve"),
  carbs_g: z.number().int().describe("Per serve"),
  fat_g: z.number().int().describe("Per serve"),
  est_cost: z.number().describe("AUD for the ingredients actually used (not whole packs)"),
  ingredients: z.array(IngredientSchema),
  steps: z.array(
    z.object({
      text: z.string(),
      minutes: z.number().int().nullable().describe("Timer length if this step involves waiting/cooking"),
    }),
  ),
  tags: z.array(z.string()).describe("e.g. high-protein, one-pan, kid-friendly, vegetarian"),
  source_url: z.string().nullable().describe("URL of the real recipe this is based on, else null"),
});
export type RecipeOut = z.infer<typeof RecipeSchema>;

export const SkeletonSchema = z.object({
  strategy: z.string().describe("2-4 sentences: how the week saves money and effort (shared ingredients, cook-once-eat-twice, prep)"),
  shared_staples: z.array(z.string()).describe(
    "The ONE version of each staple every recipe this week must use, e.g. 'olive oil', 'jasmine rice', 'brown onion', 'chicken stock', 'plain flour', 'tasty cheese', 'penne'. Never two varieties of the same staple.",
  ),
  est_total: z.number().describe("Estimated AUD for the whole shop, counting whole packs"),
  recipes: z.array(
    z.object({
      key: z.string().describe("Short unique id, e.g. 'r1'"),
      title: z.string(),
      meal_type: z.enum(MEALS),
      brief: z.string().describe("Key ingredients and method in one line"),
      servings: z.number().int().describe("Total serves to cook (covers every slot that uses it)"),
      est_cost: z.number(),
      source_url: z.string().nullable(),
    }),
  ),
  slots: z.array(
    z.object({
      day: z.enum(DAYS),
      meal_type: z.enum(MEALS),
      recipe_key: z.string(),
      is_leftover: z.boolean().describe("True when this slot eats leftovers of a recipe cooked earlier"),
      eaters: z.array(z.string()).describe("Names of the eaters at this meal"),
    }),
  ),
});
export type Skeleton = z.infer<typeof SkeletonSchema>;

export const PricingSchema = z.object({
  items: z.array(
    z.object({
      item_key: z.string(),
      pack: z.string().describe("Pack to buy, e.g. '1kg bag'"),
      packs: z.number().int(),
      price: z.number().describe("AUD total for all packs at the given store"),
    }),
  ),
});

export const SwapSchema = z.object({
  options: z.array(
    z.object({
      why: z.string().describe("Short chip text, e.g. 'uses leftover spinach, −$3'"),
      recipe: RecipeSchema,
    }),
  ),
});

export const PrepSchema = z.object({
  total_minutes: z.number().int(),
  containers: z.number().int(),
  steps: z.array(
    z.object({
      at_minute: z.number().int(),
      text: z.string(),
      recipes: z.array(z.string()).describe("Recipe titles this step serves"),
    }),
  ),
  storage: z.array(
    z.object({
      recipe: z.string(),
      where: z.enum(["fridge", "freezer"]),
      eat_by: z.enum(DAYS),
      note: z.string().nullable().describe("e.g. 'move to fridge Wed night'"),
    }),
  ),
});
export type Prep = z.infer<typeof PrepSchema>;

export const IdeasSchema = z.object({ recipes: z.array(RecipeSchema) });

export const ConsolidateSchema = z.object({
  merges: z.array(
    z.object({
      from: z.array(z.string()).describe("Ingredient names exactly as written in the recipes, to be replaced"),
      to: z.string().describe("The single product to buy instead"),
      reason: z.string().describe("Short, e.g. 'one oil does both'"),
    }),
  ),
});

export const RepairSchema = z.object({
  replacements: z.array(
    z.object({
      old_title: z.string().describe("Exact title of the recipe to replace"),
      title: z.string(),
      brief: z.string().describe("Key ingredients and method in one line"),
      why: z.string().describe("e.g. 'reuses the chicken and rice, saves ~$9'"),
    }),
  ),
});
