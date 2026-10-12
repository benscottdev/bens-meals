import Link from "next/link";
import { DrumstickRating } from "@/components/kitchen/Drumsticks";
import { Arrow, Button, PageTitle, RecipeStats, Section, cn } from "@/components/kitchen/ui";
import {
  DAY_LABEL, DAYS, MEAL_LABEL, MEALS, STORE_LABEL, dayOf, money,
  type Day, type MealPlan, type PlanSlot, type Settings,
} from "@/lib/types";

const clock = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};
const toMins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

export type DashboardData = {
  settings: Settings;
  today: string;
  nowMins: number;
  plan: MealPlan | null;
  slots: PlanSlot[];
  nextPlanned: boolean;
  recent: { week_start: string; budget: number; est_total: number | null; actual_total: number | null }[];
  reminders: { id: string; title: string; fire_at: string; url: string | null }[];
  shopping: { checked: boolean; have_it: boolean }[];
  hasPrep: boolean;
};

export function Dashboard({ settings, today, nowMins, plan, slots, nextPlanned, recent, reminders, shopping, hasPrep }: DashboardData) {
  const tz = settings.timezone;
  const day = dayOf(today);
  const hour = Math.floor(nowMins / 60);
  const ready = plan?.status === "ready";
  const todays = MEALS.map((m) => slots.find((s) => s.day === day && s.meal_type === m)).filter((s): s is PlanSlot => !!s);
  const dinner = todays.find((s) => s.meal_type === "dinner");
  const others = todays.filter((s) => s !== dinner);
  const cookServes = (rid: string) => slots.filter((s) => s.recipe_id === rid && !s.skipped).reduce((t, s) => t + Number(s.servings), 0);

  const toBuy = shopping.filter((i) => !i.have_it);
  const ticked = toBuy.filter((i) => i.checked).length;
  const planned = slots.filter((s) => s.recipe_id && !s.skipped).length;
  const gridCount = DAYS.reduce((t, d) => t + (settings.meal_grid[d]?.length ?? 0), 0);
  const lateWeek = DAYS.indexOf(day) >= 4; // Fri–Sun: nudge to plan ahead
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const reminderList = reminders.length > 0 && (
    <Section title="Coming up">
      <ul className="divide-y divide-line">
        {reminders.map((r) => {
          const when = new Date(r.fire_at);
          const whenDay = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(when) === today
            ? "Today" : when.toLocaleDateString("en-AU", { weekday: "short", timeZone: tz });
          const time = when.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: tz }).replace(" ", "").toLowerCase();
          return (
            <li key={r.id}>
              <Link href={r.url ?? "/plan"} className="flex items-baseline gap-4 py-3">
                <span className="w-24 shrink-0 text-[13px] text-muted tabular-nums">{whenDay} {time}</span>
                <span className="text-[15px]">{r.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );

  return (
    <>
      <PageTitle sub={dateLabel}>{greeting}.</PageTitle>

      <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-7">
          {!plan || plan.status === "failed" ? (
            <Section title="This week">
              <p className="mb-2 text-[1.6rem] font-light">Not planned yet.</p>
              <p className="mb-6 text-muted">{money(settings.weekly_budget)} budget · {gridCount} meals · {STORE_LABEL[settings.store]}</p>
              <Link href="/plan"><Button size="lg">Plan this week</Button></Link>
            </Section>
          ) : !ready ? (
            <Section title="This week">
              <p className="simmer text-[17px]">{plan.progress?.message ?? "Planning your week…"}</p>
              <Link href="/plan" className="mt-4 inline-block"><Arrow>Follow along</Arrow></Link>
            </Section>
          ) : (
            <>
              <Tonight dinner={dinner} serves={dinner?.recipe_id ? cookServes(dinner.recipe_id) : 0} settings={settings} nowMins={nowMins} />

              {others.length > 0 && (
                <Section title="Also today">
                  <ul className="divide-y divide-line">
                    {others.map((s) => (
                      <li key={s.id} className="flex items-baseline gap-4 py-3">
                        <span className="w-24 shrink-0 text-[13px] text-muted">{MEAL_LABEL[s.meal_type]}</span>
                        {s.skipped || !s.recipe ? (
                          <span className="text-muted">{s.skipped ? "Eating out" : "Nothing planned"}</span>
                        ) : (
                          <Link href={`/recipes/${s.recipe.id}?serves=${cookServes(s.recipe.id)}`} className="min-w-0 flex-1">
                            <span className="text-[16px]">{s.recipe.title}</span>
                            {s.leftover_of && <span className="text-[13px] text-muted"> · leftovers</span>}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>

        <div className="space-y-14 lg:col-span-5">
          {ready && plan && (
            <Section title="This week" action={<Link href="/plan" className="text-[13px] text-muted hover:text-ink">Open week</Link>}>
              <div className="grid grid-cols-3 gap-4">
                <Link href="/plan" className="block">
                  <p className="eyebrow mb-2">Budget</p>
                  <p className={cn("text-[1.6rem] font-light leading-none tabular-nums", Number(plan.est_total) > Number(plan.budget) && "text-clay")}>{money(plan.est_total)}</p>
                  <p className="mt-1 text-[12px] text-muted">of {money(plan.budget)}</p>
                </Link>
                <Link href="/plan" className="block">
                  <p className="eyebrow mb-2">Meals</p>
                  <p className="text-[1.6rem] font-light leading-none tabular-nums">{planned}</p>
                  <p className="mt-1 text-[12px] text-muted">planned</p>
                </Link>
                <Link href="/shop" className="block">
                  <p className="eyebrow mb-2">Shopping</p>
                  <p className="text-[1.6rem] font-light leading-none tabular-nums">{ticked}<span className="text-[1rem] text-muted">/{toBuy.length}</span></p>
                  <p className="mt-1 text-[12px] text-muted">{toBuy.length && ticked === toBuy.length ? "all bought" : "bought"}</p>
                </Link>
              </div>
              <WeekStrip slots={slots} today={day} />
              <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3">
                <Link href="/shop"><Arrow>Shopping list</Arrow></Link>
                {hasPrep && <Link href="/prep"><Arrow>Prep run sheet</Arrow></Link>}
              </div>
            </Section>
          )}

          {reminderList}

          {lateWeek && !nextPlanned && (
            <Section title="Next week">
              <p className="mb-4 text-[16px] text-muted">Not planned yet — do it now and the list is ready for the weekend shop.</p>
              <Link href="/plan?week=next"><Arrow>Plan next week</Arrow></Link>
            </Section>
          )}

          {recent.length > 0 && (
            <Section title="Recent weeks" action={<Link href="/settings/stats" className="text-[13px] text-muted hover:text-ink">History</Link>}>
              <ul className="divide-y divide-line">
                {recent.map((w) => {
                  const spent = Number(w.actual_total ?? w.est_total ?? 0);
                  const over = spent > Number(w.budget);
                  return (
                    <li key={w.week_start} className="flex items-baseline justify-between py-2.5 text-[14px]">
                      <span className="text-muted">{new Date(`${w.week_start}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
                      <span className={cn("tabular-nums", over && "text-clay")}>
                        {money(spent)} <span className="text-muted">/ {money(w.budget)}{w.actual_total == null && " est."}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section title="Shortcuts">
            <div className="flex flex-wrap gap-x-7 gap-y-3">
              <Link href="/recipes"><Arrow>Fridge rescue</Arrow></Link>
              <Link href="/pantry"><Arrow>Pantry</Arrow></Link>
              <Link href="/recipes?tab=favourites"><Arrow>Favourites</Arrow></Link>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Tonight({ dinner, serves, settings, nowMins }: { dinner?: PlanSlot; serves: number; settings: Settings; nowMins: number }) {
  if (!dinner) {
    return (
      <Section title="Tonight">
        <p className="text-[1.6rem] font-light leading-snug">No dinner planned.</p>
        <Link href="/plan" className="mt-4 inline-block"><Arrow>Add one</Arrow></Link>
      </Section>
    );
  }
  if (dinner.skipped) {
    return (
      <Section title="Tonight">
        <p className="text-[1.6rem] font-light leading-snug">Eating out — nothing to cook.</p>
      </Section>
    );
  }
  const r = dinner.recipe!;
  const eatAt = toMins(settings.dinner_time);
  const startAt = eatAt - (r.prep_minutes + r.cook_minutes) - 5;
  const leftovers = !!dinner.leftover_of;
  const status = leftovers
    ? "Leftovers — just reheat"
    : nowMins < startAt ? `Start at ${clock(startAt)} to eat at ${clock(eatAt)}`
    : nowMins < eatAt ? `Start now to eat around ${clock(nowMins + r.prep_minutes + r.cook_minutes)}`
    : `${r.prep_minutes + r.cook_minutes} min, start to finish`;

  return (
    <Section title="Tonight" action={<span className="text-right text-[13px] text-muted">{status}</span>}>
      <Link href={`/recipes/${r.id}?serves=${serves}`} className="block">
        <h3 className="text-[2rem] font-light leading-[1.1] md:text-[2.6rem]">{r.title}</h3>
        {r.description && <p className="mt-2 text-[15px] text-muted">{r.description}</p>}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <RecipeStats r={r} />
        <DrumstickRating value={r.difficulty} size={14} />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-6">
        {!leftovers && <Link href={`/recipes/${r.id}/cook?serves=${serves}`}><Button size="lg">Start cooking</Button></Link>}
        <Link href={`/recipes/${r.id}?serves=${serves}`}><Arrow>Recipe</Arrow></Link>
      </div>
    </Section>
  );
}

/** Seven small dots: which days still have dinner to cook, leftovers or nothing. */
function WeekStrip({ slots, today }: { slots: PlanSlot[]; today: Day }) {
  return (
    <div className="mt-8">
      <ol className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d) => {
          const din = slots.find((s) => s.day === d && s.meal_type === "dinner");
          const past = DAYS.indexOf(d) < DAYS.indexOf(today);
          return (
            <li key={d} className={cn("space-y-1.5", past && "opacity-35")}>
              <p className={cn("text-[12px]", d === today ? "text-ink" : "text-muted")}>{DAY_LABEL[d]}</p>
              <span
                title={din?.recipe?.title ?? "No dinner"}
                className={cn(
                  "mx-auto block h-2 w-2 rounded-full",
                  !din || din.skipped ? "border border-line-strong" : din.leftover_of ? "bg-line-strong" : "bg-ink",
                  d === today && "ring-2 ring-ink/15 ring-offset-2 ring-offset-paper",
                )}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
