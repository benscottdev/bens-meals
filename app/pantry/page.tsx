import { PageTitle } from "@/components/kitchen/ui";
import { PantryList } from "@/components/prep/PantryList";
import { session } from "@/lib/data";

export default async function Pantry() {
  const { supabase } = await session();
  const { data } = await supabase.from("pantry_items").select("id, name, is_staple").order("is_staple", { ascending: false }).order("name");
  return (
    <>
      <PageTitle sub="Already in the cupboard">Pantry</PageTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">Anything here won&apos;t be added to your shopping list. Staples (oil, salt, spices) stay forever; other items are added when you mark “I already have it”.</p>
      <PantryList items={data ?? []} />
    </>
  );
}
