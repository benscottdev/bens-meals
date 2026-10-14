import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedRecipe } from "@/components/share/SharedRecipe";
import { SharedWeekView } from "@/components/share/SharedWeekView";
import { loadShare } from "@/lib/share";

export const metadata: Metadata = { title: "Shared from Ben's Meals", robots: { index: false, follow: false } };

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) notFound();
  return share.kind === "week"
    ? <SharedWeekView token={token} week={share} />
    : <><p className="eyebrow mb-3">Shared from Ben&apos;s Meals</p><SharedRecipe r={share.recipe} heading="h1" /></>;
}
