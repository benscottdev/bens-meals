import { PageTitle, Section } from "@/components/kitchen/ui";
import { DAY_LABEL, DAYS, MEAL_LABEL, MEALS, STORE_LABEL, type Day, type PlanSlot, type Recipe } from "@/lib/types";
import type { SharedWeek } from "@/lib/share";
import { SharedList } from "./SharedList";
import { SharedRecipe } from "./SharedRecipe";

const DAY_NAME: Record<Day, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

export function SharedWeekView({ token, week }: { token: string; week: SharedWeek }) {
  const { plan, slots, items } = week;
  const label = new Date(`${plan.week_start}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
  const live = slots.filter((s): s is PlanSlot & { recipe: Recipe } => !!s.recipe && !s.skipped);
  // Cook enough for everyone eating it across the week, leftovers included.
  const serves = new Map<string, number>();
  live.forEach((s) => serves.set(s.recipe.id, (serves.get(s.recipe.id) ?? 0) + Number(s.servings)));
  const order = (s: PlanSlot) => DAYS.indexOf(s.day) * 10 + MEALS.indexOf(s.meal_type);
  const recipes = [...new Map([...live].sort((a, b) => order(a) - order(b)).map((s) => [s.recipe.id, s.recipe])).values()];
  const dateOf = (d: Day) => {
    const x = new Date(`${plan.week_start}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + DAYS.indexOf(d));
    return x.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
  };

  return (
    <>
      <PageTitle sub={`Shared from Ben's Meals · ${STORE_LABEL[plan.store]}`}>Week of {label}</PageTitle>

      <Section title="Meals">
        <div className="grid gap-x-10 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {DAYS.map((d) => {
            const day = slots.filter((s) => s.day === d).sort((a, b) => order(a) - order(b));
            if (!day.length) return null;
            return (
              <section key={d} className="border-t border-line pt-5 pb-9">
                <div className="mb-4 flex items-baseline justify-between">
                  <h3 className="text-[1.15rem] font-normal tracking-normal">{DAY_NAME[d]}</h3>
                  <p className="text-[12px] text-muted">{dateOf(d)}</p>
                </div>
                <ul className="space-y-4">
                  {day.map((s) => (
                    <li key={s.id}>
                      <p className="eyebrow mb-1">{MEAL_LABEL[s.meal_type]}{s.leftover_of && " · leftovers"}</p>
                      {s.skipped ? <p className="text-muted">Eating out</p>
                        : s.recipe ? <a href={`#r-${s.recipe.id}`} className="text-[17px] leading-snug hover:underline">{s.recipe.title}</a>
                        : <p className="text-muted">—</p>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Section>

      {items && items.length > 0 && (
        <Section title="Shopping list" className="mt-14" action={<span className="text-[13px] text-muted">ticks stay on this device</span>}>
          <SharedList token={token} items={items} />
        </Section>
      )}

      <Section title={`Recipes (${recipes.length})`} className="mt-14">
        <div className="space-y-20">
          {recipes.map((r) => (
            <div key={r.id} className="border-t border-line pt-8 first:border-t-0 first:pt-0">
              <SharedRecipe r={r} serves={serves.get(r.id)} />
              <p className="mt-6 text-[13px] text-muted">
                Eaten {live.filter((s) => s.recipe.id === r.id).map((s) => `${DAY_LABEL[s.day]} ${MEAL_LABEL[s.meal_type].toLowerCase()}`).join(", ")}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
