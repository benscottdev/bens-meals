import { notFound } from "next/navigation";
import { RecipeView } from "@/components/recipes/RecipeView";
import { getRecipe } from "@/lib/data";

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ serves?: string }> }) {
  const raw = Number((await searchParams).serves);
  const serves = raw > 0 && raw <= 24 ? raw : undefined;
  const { recipe, feedback } = await getRecipe((await params).id);
  if (!recipe) notFound();
  return <RecipeView r={recipe} fb={feedback} initialServes={serves} />;
}
