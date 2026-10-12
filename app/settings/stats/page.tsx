import { Empty, PageTitle, Section } from "@/components/kitchen/ui";
import { session } from "@/lib/data";
import { money } from "@/lib/types";

export default async function Stats() {
  const { supabase } = await session();
  const { data: plans } = await supabase.from("meal_plans").select("id, week_start, budget, est_total, actual_total")
    .eq("status", "ready").order("week_start", { ascending: false }).limit(12);
  const { count: cooked } = await supabase.from("recipe_feedback").select("*", { count: "exact", head: true }).gt("cooked_count", 0);
  const { data: slotCounts } = await supabase.from("plan_slots").select("plan_id").eq("skipped", false).not("recipe_id", "is", null);
  const meals = new Map<string, number>();
  (slotCounts ?? []).forEach((s) => meals.set(s.plan_id, (meals.get(s.plan_id) ?? 0) + 1));

  if (!plans?.length) return (<><PageTitle sub="History">Spending</PageTitle><Empty title="No weeks yet" /></>);
  const spent = (p: (typeof plans)[number]) => Number(p.actual_total ?? p.est_total ?? 0);
  const max = Math.max(...plans.map((p) => Math.max(spent(p), Number(p.budget))));
  const avgMeal = plans.reduce((t, p) => t + spent(p), 0) / Math.max(1, plans.reduce((t, p) => t + (meals.get(p.id) ?? 0), 0));

  return (
    <>
      <PageTitle sub="History">Spending</PageTitle>
      <Section title="At a glance" className="mb-14">
        <div className="grid grid-cols-2 gap-10">
          <div><div className="eyebrow mb-2">Avg per meal</div><div className="text-4xl font-light">{money(avgMeal)}</div></div>
          <div><div className="eyebrow mb-2">Recipes cooked</div><div className="text-4xl font-light">{cooked ?? 0}</div></div>
        </div>
      </Section>
      <Section title="Weekly shop vs budget" action={<span className="text-[13px] text-muted">actual where entered</span>} className="space-y-3">
        {plans.map((p) => (
          <div key={p.week_start} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="text-muted">{new Date(`${p.week_start}T12:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
            <div className="relative h-3 rounded-full bg-line">
              <div className={`h-full rounded-full ${spent(p) > Number(p.budget) ? "bg-clay" : p.actual_total != null ? "bg-ink" : "bg-olive"}`} style={{ width: `${(100 * spent(p)) / max}%` }} />
              <div className="absolute top-[-3px] h-[18px] w-px bg-ink/60" style={{ left: `${(100 * Number(p.budget)) / max}%` }} title={`Budget ${money(p.budget)}`} />
            </div>
            <span className="text-right font-medium">{money(spent(p))}</span>
          </div>
        ))}
      </Section>
    </>
  );
}
