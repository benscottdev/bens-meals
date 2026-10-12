import Link from "next/link";
import { Empty, PageTitle, cn } from "@/components/kitchen/ui";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { RecipeTools } from "@/components/recipes/RecipeTools";
import { session } from "@/lib/data";
import type { Recipe } from "@/lib/types";

export default async function Recipes({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = "favourites", q } = await searchParams;
  const { supabase } = await session();
  const { data: fb } = await supabase.from("recipe_feedback").select("recipe_id, favourite, never_again");
  const favIds = new Set((fb ?? []).filter((f) => f.favourite).map((f) => f.recipe_id));
  let query = supabase.from("recipes").select("*").order("created_at", { ascending: false }).limit(100);
  if (tab === "favourites") query = query.in("id", [...favIds].length ? [...favIds] : ["00000000-0000-0000-0000-000000000000"]);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data } = await query;
  const recipes = (data ?? []) as Recipe[];

  return (
    <>
      <PageTitle sub="The recipe box">Recipes</PageTitle>
      <RecipeTools />
      <div className="mb-4 flex items-center gap-3">
        <div className="steel inline-flex rounded-[2px] p-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
          {[["favourites", "Favourites"], ["all", "All"]].map(([k, l]) => (
            <Link key={k} href={`/recipes?tab=${k}`} className={cn("rounded-[2px] px-4 py-1.5", tab === k ? "bg-ink text-[#f5f2ec]" : "text-muted")}>{l}</Link>
          ))}
        </div>
        <form className="flex-1"><input type="hidden" name="tab" value={tab} /><input name="q" defaultValue={q} placeholder="Search…" className="field !py-2 text-sm" /></form>
      </div>
      {recipes.length ? (
        <div className="grid gap-3">{recipes.map((r) => <RecipeCard key={r.id} r={r} favourite={favIds.has(r.id)} />)}</div>
      ) : (
        <Empty title={tab === "favourites" ? "No favourites yet" : "No recipes yet"}>
          <p className="text-sm text-muted">{tab === "favourites" ? "Tap the heart on any recipe you love." : "Plan a week and they'll appear here."}</p>
        </Empty>
      )}
    </>
  );
}
