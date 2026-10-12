import { notFound } from "next/navigation";
import { CookMode } from "@/components/recipes/CookMode";
import { getRecipe } from "@/lib/data";

export default async function Cook({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ serves?: string }> }) {
  const raw = Number((await searchParams).serves);
  const serves = raw > 0 && raw <= 24 ? raw : undefined;
  const { recipe } = await getRecipe((await params).id);
  if (!recipe) notFound();
  return <CookMode r={recipe} serves={serves} />;
}
