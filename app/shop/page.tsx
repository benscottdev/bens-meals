import Link from "next/link";
import { Button, Empty, PageTitle } from "@/components/kitchen/ui";
import { ShoppingList } from "@/components/shop/ShoppingList";
import { getActivePlan, session } from "@/lib/data";
import type { ShoppingItem } from "@/lib/types";

export default async function Shop() {
  const { plan } = await getActivePlan();
  if (!plan || plan.status !== "ready") {
    return (<><PageTitle sub="The list">Shopping</PageTitle>
      <Empty title={plan?.status === "generating" ? "Still cooking up your plan…" : "No list yet"}><Link href="/plan"><Button>Plan a week</Button></Link></Empty></>);
  }
  const { supabase } = await session();
  const { data } = await supabase.from("shopping_items").select("*").eq("plan_id", plan.id).order("name");
  const label = new Date(`${plan.week_start}T12:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long" });
  return (
    <>
      <PageTitle sub={`Week of ${label}`}>Shopping</PageTitle>
      <ShoppingList plan={plan} items={(data ?? []) as ShoppingItem[]} />
    </>
  );
}
