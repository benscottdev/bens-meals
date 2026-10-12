import Link from "next/link";
import { PageTitle, cn } from "@/components/kitchen/ui";
import { WeekPlanner } from "@/components/plan/WeekPlanner";
import { getFavourites, getPlan, getSavedWeeks, resolveWeek, settingsOrOnboard } from "@/lib/data";
import { STORE_LABEL, nextWeekStart, weekStart } from "@/lib/types";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string; next?: string }> }) {
  const sp = await searchParams;
  const settings = await settingsOrOnboard();
  const week = resolveWeek(sp.next ? "next" : sp.week);
  const [{ plan, slots }, favourites, savedWeeks] = await Promise.all([getPlan(week), getFavourites(), getSavedWeeks()]);
  const isNext = week === nextWeekStart();
  const label = new Date(`${week}T12:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long" });

  return (
    <>
      <PageTitle sub={`Week of ${label} · ${STORE_LABEL[settings.store]}`}>{isNext ? "Next week" : "This week"}</PageTitle>
      <nav className="-mt-4 mb-8 flex gap-6 text-[14px]">
        {[{ k: weekStart(), label: "This week", href: "/plan" }, { k: nextWeekStart(), label: "Next week", href: "/plan?week=next" }].map((t) => (
          <Link key={t.k} href={t.href} className={cn("pb-1", week === t.k ? "border-b border-ink" : "text-muted hover:text-ink")}>{t.label}</Link>
        ))}
      </nav>
      <WeekPlanner key={`${week}-${plan?.status}`} weekStart={week} plan={plan} slots={slots} settings={settings} favourites={favourites} savedWeeks={savedWeeks} />
    </>
  );
}
