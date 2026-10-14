"use client";
import { GripVertical, Lock, Minus, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { applySwap, clearSlot, deleteSavedWeek, loadSavedWeek, moveSlot, saveWeek, setSlotRecipe, setWeekServings, suggestSwaps, toggleLock, toggleSkip } from "@/app/actions";
import { DrumstickRating } from "@/components/kitchen/Drumsticks";
import { Sheet } from "@/components/kitchen/Sheet";
import { Arrow, Button, Chip, RecipeStats, Section, cn } from "@/components/kitchen/ui";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { ShareSheet } from "@/components/share/ShareSheet";
import type { RecipeOut } from "@/lib/claude/schemas";
import type { SavedWeek } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { DAY_LABEL, DAYS, MEAL_LABEL, MEALS, money, type Day, type MealPlan, type MealType, type PlanSlot, type Recipe, type Settings } from "@/lib/types";

type Props = { weekStart: string; plan: MealPlan | null; slots: PlanSlot[]; settings: Settings; favourites: Recipe[]; savedWeeks: SavedWeek[] };

const DAY_NAME: Record<Day, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

function dateLabel(weekStart: string, day: Day) {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + DAYS.indexOf(day));
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function WeekPlanner({ weekStart, plan, slots, settings, favourites, savedWeeks }: Props) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [saving, setSaving] = useState(false);
  const [library, setLibrary] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(plan?.progress);
  const generating = plan?.status === "generating" || starting;
  // Rearranging: local copy so moves show instantly; drag on desktop, tap-to-swap anywhere.
  const [localSlots, setLocalSlots] = useState(slots);
  useEffect(() => setLocalSlots(slots), [slots]);
  const [rearrange, setRearrange] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [, startMove] = useTransition();

  // Follow generation progress until it finishes, then reload the server data.
  useEffect(() => {
    if (plan?.status !== "generating") return;
    const db = createClient();
    const t = setInterval(async () => {
      const { data } = await db.from("meal_plans").select("status, progress").eq("id", plan.id).single();
      if (!data) return;
      setProgress(data.progress);
      if (data.status !== "generating") {
        clearInterval(t);
        router.refresh();
      }
    }, 2500);
    return () => clearInterval(t);
  }, [plan?.id, plan?.status, router]);

  async function generate() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/plan/generate", { method: "POST", body: JSON.stringify({ weekStart }) });
    if (!res.ok) setError((await res.json()).error ?? "Couldn't start");
    setStarting(false);
    router.refresh();
  }

  const mealCount = Object.values(settings.meal_grid).flat().length;
  const adjustSheet = (
    <Sheet open={adjust} onClose={() => setAdjust(false)} title={plan ? "Adjust & regenerate" : "Before we plan"} wide>
      {plan && <p className="-mt-3 mb-6 text-sm text-muted">Locked meals stay. Everything else is planned again with these settings.</p>}
      <SettingsForm
        initial={settings}
        inSheet
        submitLabel={plan ? "Save & regenerate" : "Save & plan my week"}
        onSaved={async () => { setAdjust(false); await generate(); }}
      />
    </Sheet>
  );

  if (!plan || (plan.status === "failed" && !slots.length)) {
    return (
      <div className="space-y-6 border-t border-line-strong pt-8">
        <h2 className="text-3xl">Nothing planned yet.</h2>
        <p className="text-muted">
          {money(settings.weekly_budget)} budget · {mealCount} meals · {settings.plan_mode === "find" ? "real recipes from the web" : "original recipes"}
        </p>
        {plan?.status === "failed" && <p className="text-sm text-clay">Last attempt failed: {plan.progress?.message}</p>}
        <div className="flex flex-wrap items-center gap-6">
          <Button size="lg" onClick={generate} disabled={generating}>{generating ? "Starting…" : "Plan my week"}</Button>
          <button onClick={() => setAdjust(true)}><Arrow>Adjust settings first</Arrow></button>
          {savedWeeks.length > 0 && <button onClick={() => setLibrary(true)}><Arrow>Use a saved week</Arrow></button>}
        </div>
        {error && <p className="text-sm text-clay">{error}</p>}
        {adjustSheet}
        <SavedWeeksSheet open={library} onClose={() => setLibrary(false)} weeks={savedWeeks} weekStart={weekStart} replaces={false} />
      </div>
    );
  }

  const slotAt = (day: Day, meal: MealType) => localSlots.find((s) => s.day === day && s.meal_type === meal);
  const moveTo = (fromId: string, toDay: Day, toMeal: MealType) => {
    const a = localSlots.find((s) => s.id === fromId);
    if (!a || (a.day === toDay && a.meal_type === toMeal)) return;
    const b = slotAt(toDay, toMeal);
    setLocalSlots((xs) => xs.map((s) =>
      s.id === a.id ? { ...s, day: toDay, meal_type: toMeal } : b && s.id === b.id ? { ...s, day: a.day, meal_type: a.meal_type } : s));
    setPicked(null);
    startMove(async () => {
      try { await moveSlot(plan.id, a.id, toDay, toMeal); router.refresh(); }
      catch (e) { setError((e as Error).message); setLocalSlots(slots); }
    });
  };
  const arrangeFor = (day: Day, meal: MealType, slot?: PlanSlot): Arrange => {
    const key = `${day}|${meal}`;
    return {
      mode: rearrange,
      picked: !!slot && picked === slot.id,
      over: dragOver === key,
      onTap: () => {
        if (picked && (!slot || picked !== slot.id)) moveTo(picked, day, meal);
        else setPicked(slot && picked !== slot.id ? slot.id : null);
      },
      onMove: (toDay, toMeal) => slot && moveTo(slot.id, toDay, toMeal),
      drop: {
        onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== key) setDragOver(key); },
        onDragLeave: () => setDragOver((k) => (k === key ? null : k)),
        onDrop: (e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) moveTo(id, day, meal); },
      },
    };
  };
  const targets = DAYS.flatMap((d) => MEALS.filter((m) => settings.meal_grid[d]?.includes(m) || slotAt(d, m))
    .map((m) => ({ day: d, meal: m, title: slotAt(d, m)?.recipe?.title ?? null })));
  // Serves to cook per recipe = everyone eating it across the week (so leftovers get cooked too).
  const cookServes = new Map<string, number>();
  localSlots.forEach((s) => { if (s.recipe_id && !s.skipped) cookServes.set(s.recipe_id, (cookServes.get(s.recipe_id) ?? 0) + Number(s.servings)); });
  const est = Number(plan.est_total ?? 0);
  const budget = Number(plan.budget);
  const diff = budget - est;

  return (
    <div>
      {generating && (
        <div className="mb-8 border-t border-line pt-5">
          <p className="simmer text-[17px]">{progress?.message ?? "Planning your week…"}</p>
          <div className="mt-3 h-px bg-line">
            <div className="h-px bg-ink transition-all duration-700" style={{ width: `${progress?.total ? (100 * (progress.done ?? 0)) / progress.total : 8}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-muted">Usually a minute or two. You can leave this page.</p>
        </div>
      )}
      {plan.status === "failed" && <p className="mb-6 text-sm text-clay">Regenerating failed: {plan.progress?.message}</p>}

      <Section title="Budget & plan">
        <div className="grid gap-x-16 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[2rem] font-light leading-none tabular-nums">
            {money(est)} <span className="text-[1rem] text-muted">of {money(budget)}</span>
          </p>
          <p className={cn("text-[13px]", diff < 0 ? "text-clay" : "text-olive")}>
            {diff < 0 ? `${money(-diff)} over` : `${money(diff)} left`}
          </p>
        </div>
        <div className="mt-4 h-px bg-line">
          <div className={cn("h-px", diff < 0 ? "bg-clay" : "bg-ink")} style={{ width: `${Math.min(100, (100 * est) / budget)}%` }} />
        </div>
        <CookingFor planId={plan.id} slots={slots} disabled={generating} />
        </div>
        <div className="lg:col-span-7">
        {plan.strategy && <p className="text-[15px] leading-relaxed text-muted">{plan.strategy}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link href="/shop"><Arrow>Shopping list</Arrow></Link>
          {settings.prep_day && <Link href="/prep"><Arrow>Prep run sheet</Arrow></Link>}
          <button onClick={() => setSharing(true)} disabled={generating} className="disabled:opacity-40"><Arrow>Share week</Arrow></button>
          <button onClick={() => setSaving(true)} disabled={generating} className="disabled:opacity-40"><Arrow>Save week</Arrow></button>
          <button onClick={() => setAdjust(true)} disabled={generating} className="disabled:opacity-40"><Arrow>Adjust & regenerate</Arrow></button>
          <button onClick={generate} disabled={generating} className="text-[14px] text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40">
            Regenerate as is
          </button>
          {savedWeeks.length > 0 && (
            <button onClick={() => setLibrary(true)} disabled={generating} className="text-[14px] text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40">
              Saved weeks ({savedWeeks.length})
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
        </div>
        </div>
      </Section>

      <Section
        title="Meals"
        className="mt-14"
        action={
          <button onClick={() => { setRearrange((r) => !r); setPicked(null); }} disabled={generating}
            className={cn("rounded-full border px-3.5 py-1.5 text-[13px] disabled:opacity-40", rearrange ? "border-ink bg-ink text-paper" : "border-line-strong text-muted hover:border-ink hover:text-ink")}>
            {rearrange ? "Done" : "Rearrange"}
          </button>
        }
      >
      <p className="-mt-3 mb-6 text-[13px] text-muted">
        {rearrange
          ? picked ? "Now tap where it should go — a filled spot swaps." : "Tap a meal, then tap the day it should move to."
          : <>Drag meals between days to rearrange{" "}<span className="md:hidden">— or tap Rearrange</span>.</>}
      </p>
      <div className="grid gap-x-10 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {DAYS.map((day) => {
          const meals = MEALS.filter((m) => settings.meal_grid[day]?.includes(m) || slotAt(day, m));
          if (!meals.length) return null;
          return (
            <section key={day} className="border-t border-line pt-5 pb-9">
              <div className="mb-4 flex items-baseline justify-between">
                <h3 className="text-[1.15rem] font-normal tracking-normal">{DAY_NAME[day]}</h3>
                <p className="text-[12px] text-muted">{dateLabel(weekStart, day)}</p>
              </div>
              <ul className="space-y-5">
                {meals.map((m) => (
                  <SlotRow key={m} plan={plan} day={day} meal={m} slot={slotAt(day, m)} favourites={favourites} cookServes={cookServes} arrange={arrangeFor(day, m, slotAt(day, m))} targets={targets} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      </Section>
      {adjustSheet}
      <ShareSheet open={sharing} onClose={() => setSharing(false)} target={{ planId: plan.id }} title={`Meals for the week of ${dateLabel(weekStart, "mon")}`} isWeek />
      <SaveWeekSheet open={saving} onClose={() => setSaving(false)} planId={plan.id} defaultName={`Week of ${dateLabel(weekStart, "mon")}`} />
      <SavedWeeksSheet open={library} onClose={() => setLibrary(false)} weeks={savedWeeks} weekStart={weekStart} replaces />
    </div>
  );
}

function CookingFor({ planId, slots, disabled }: { planId: string; slots: PlanSlot[]; disabled: boolean }) {
  // Most common serving size this week (slots can differ if eaters skip meals).
  const counts = new Map<number, number>();
  slots.forEach((s) => counts.set(Number(s.servings), (counts.get(Number(s.servings)) ?? 0) + 1));
  const current = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setValue(current), [current]);
  const apply = (n: number) => {
    const next = Math.max(1, Math.min(12, n));
    setValue(next); setError(null);
    start(async () => { try { await setWeekServings(planId, next); } catch (e) { setError((e as Error).message); setValue(current); } });
  };
  return (
    <div className="mt-5 flex items-center justify-between gap-4">
      <span className="text-[14px] text-muted">{pending ? "Rescaling recipes and re-pricing…" : "Cooking for"}</span>
      <div className={cn("flex items-center rounded-full border border-line-strong", pending && "opacity-50")}>
        <button className="p-2.5 disabled:opacity-30" aria-label="Fewer people" disabled={disabled || pending || value <= 1} onClick={() => apply(value - 1)}><Minus size={14} strokeWidth={1.5} /></button>
        <span className="min-w-[4.5rem] text-center text-[14px] tabular-nums">{value} {value === 1 ? "person" : "people"}</span>
        <button className="p-2.5 disabled:opacity-30" aria-label="More people" disabled={disabled || pending || value >= 12} onClick={() => apply(value + 1)}><Plus size={14} strokeWidth={1.5} /></button>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
    </div>
  );
}

function SaveWeekSheet({ open, onClose, planId, defaultName }: { open: boolean; onClose: () => void; planId: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [favourite, setFavourite] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = () => { setDone(false); setError(null); onClose(); };
  return (
    <Sheet open={open} onClose={close} title="Save this week">
      {done ? (
        <div className="space-y-6">
          <p>Saved as “{name}”. Load it into any week from <span className="text-muted">Saved weeks</span>.</p>
          <Button onClick={close}>Done</Button>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => { try { await saveWeek(planId, name, favourite); setDone(true); } catch (err) { setError((err as Error).message); } });
        }}>
          <p className="-mt-3 text-sm text-muted">Keeps every meal, leftovers, locks and the prep plan so you can reuse the whole week later.</p>
          <label className="block space-y-2">
            <span className="eyebrow">Name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="flex items-center gap-3 text-[15px]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={favourite} onChange={(e) => setFavourite(e.target.checked)} />
            Add every recipe to favourites
          </label>
          {error && <p className="text-sm text-clay">{error}</p>}
          <Button size="lg" className="w-full" disabled={pending}>{pending ? "Saving…" : "Save week"}</Button>
        </form>
      )}
    </Sheet>
  );
}

function SavedWeeksSheet({ open, onClose, weeks, weekStart, replaces }: { open: boolean; onClose: () => void; weeks: SavedWeek[]; weekStart: string; replaces: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const load = (w: SavedWeek) => {
    if (replaces && !confirm(`Replace this week's meals with “${w.name}”?`)) return;
    setBusy(w.id); setError(null);
    start(async () => {
      try {
        const { missing } = await loadSavedWeek(w.id, weekStart);
        if (missing) alert(`${missing} meal${missing > 1 ? "s" : ""} used recipes you've since deleted and were left out.`);
        onClose();
        router.refresh();
      } catch (err) { setError((err as Error).message); }
      setBusy(null);
    });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Saved weeks">
      {replaces && <p className="-mt-3 mb-5 text-sm text-muted">Loading one replaces this week&apos;s meals and rebuilds the shopping list.</p>}
      {error && <p className="mb-4 text-sm text-clay">{error}</p>}
      <ul className="divide-y divide-line border-y border-line">
        {weeks.map((w) => (
          <li key={w.id} className="flex items-center gap-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[16px]">{w.name}</p>
              <p className="text-[12px] text-muted">
                {w.meals} meals{w.est_total != null && ` · ${money(w.est_total)}`} · saved {new Date(w.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
              </p>
            </div>
            <Button size="sm" disabled={!!busy} onClick={() => load(w)}>{busy === w.id ? "Loading…" : "Load"}</Button>
            <button className="text-[13px] text-muted hover:text-clay" disabled={!!busy}
              onClick={() => confirm(`Delete “${w.name}”?`) && start(async () => { await deleteSavedWeek(w.id); router.refresh(); })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

type Arrange = {
  mode: boolean;
  picked: boolean;
  over: boolean;
  onTap: () => void;
  onMove: (day: Day, meal: MealType) => void;
  drop: Pick<React.HTMLAttributes<HTMLLIElement>, "onDragOver" | "onDragLeave" | "onDrop">;
};
type Target = { day: Day; meal: MealType; title: string | null };

function SlotRow({ plan, day, meal, slot, favourites, cookServes, arrange, targets }: {
  plan: MealPlan; day: Day; meal: MealType; slot?: PlanSlot; favourites: Recipe[]; cookServes: Map<string, number>; arrange: Arrange; targets: Target[];
}) {
  const [menu, setMenu] = useState(false);
  const [moving, setMoving] = useState(false);
  const [swap, setSwap] = useState(false);
  const [pick, setPick] = useState(false);
  const [pending, start] = useTransition();
  const r = slot?.recipe;
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setMenu(false); });

  return (
    <li
      {...arrange.drop}
      draggable={!!slot && !arrange.mode}
      onDragStart={(e) => { if (slot) { e.dataTransfer.setData("text/plain", slot.id); e.dataTransfer.effectAllowed = "move"; } }}
      onClick={arrange.mode ? arrange.onTap : undefined}
      className={cn(
        "group -mx-2 flex items-start gap-2 rounded-[2px] px-2 py-1 transition-colors",
        pending && "opacity-40",
        slot && !arrange.mode && "md:cursor-grab md:active:cursor-grabbing",
        arrange.mode && "cursor-pointer hover:bg-sand/60",
        arrange.picked && "bg-sand ring-1 ring-ink",
        arrange.over && "bg-sand",
      )}
    >
      {slot && !arrange.mode && <GripVertical size={14} strokeWidth={1.4} className="mt-6 hidden shrink-0 text-line-strong group-hover:text-muted md:block" aria-hidden />}
      <div className={cn("min-w-0 flex-1", arrange.mode && "pointer-events-none")}>
        <p className="eyebrow mb-1">{MEAL_LABEL[meal]}{slot?.leftover_of && " · leftovers"}</p>
        {slot?.skipped ? (
          <p className="text-muted">Eating out</p>
        ) : r ? (
          <Link href={`/recipes/${r.id}?serves=${cookServes.get(r.id) ?? slot.servings}`} className="block">
            <p className="text-[17px] leading-snug">{r.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <RecipeStats r={r} compact />
              <DrumstickRating value={r.difficulty} size={13} />
            </div>
          </Link>
        ) : (
          <button className="text-[15px] text-muted underline underline-offset-4" onClick={() => setPick(true)}>Choose a favourite</button>
        )}
      </div>
      {slot?.locked && <Lock size={14} strokeWidth={1.4} className="mt-6 text-muted" aria-label="Locked" />}
      {slot && !arrange.mode && (
        <button className="mt-5 p-1 text-muted hover:text-ink" onClick={() => setMenu(true)} aria-label={`Options for ${DAY_LABEL[day]} ${meal}`}>
          <MoreHorizontal size={18} strokeWidth={1.4} />
        </button>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={`${DAY_LABEL[day]} · ${MEAL_LABEL[meal]}`}>
        <ul className="divide-y divide-line border-y border-line text-[16px]">
          {[
            { label: "Move to another day", onClick: () => { setMenu(false); setMoving(true); } },
            { label: "Swap for something else", onClick: () => { setMenu(false); setSwap(true); }, disabled: !!slot?.locked },
            { label: "Choose from favourites", onClick: () => { setMenu(false); setPick(true); } },
            { label: slot?.locked ? "Unlock" : "Lock — keep when regenerating", onClick: () => run(() => toggleLock(slot!.id, !slot!.locked)) },
            { label: slot?.skipped ? "Cooking after all" : "Eating out / skip", onClick: () => run(() => toggleSkip(slot!.id, plan.id, !slot!.skipped)) },
            { label: "Remove", onClick: () => run(() => clearSlot(slot!.id, plan.id)), danger: true },
          ].map((a) => (
            <li key={a.label}>
              <button disabled={a.disabled || pending} onClick={a.onClick} className={cn("w-full py-4 text-left disabled:opacity-40", a.danger && "text-clay")}>{a.label}</button>
            </li>
          ))}
        </ul>
      </Sheet>

      {swap && slot && <SwapSheet slotId={slot.id} current={r?.title} onClose={() => setSwap(false)} />}

      <Sheet open={moving} onClose={() => setMoving(false)} title={`Move ${r?.title ?? "this meal"}`}>
        <p className="-mt-3 mb-5 text-sm text-muted">Pick where it should go. If something&apos;s already there, they swap.</p>
        <ul className="divide-y divide-line border-y border-line">
          {targets.filter((t) => !(t.day === day && t.meal === meal)).map((t) => (
            <li key={`${t.day}|${t.meal}`}>
              <button className="flex w-full items-baseline gap-4 py-3 text-left" onClick={() => { setMoving(false); arrange.onMove(t.day, t.meal); }}>
                <span className="w-28 shrink-0 text-[14px]">{DAY_LABEL[t.day]} · {MEAL_LABEL[t.meal]}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-muted">{t.title ? `swap with ${t.title}` : "empty"}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={pick} onClose={() => setPick(false)} title="Favourites">
        {favourites.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {favourites.map((f) => (
              <li key={f.id}>
                <button className="w-full py-4 text-left" disabled={pending} onClick={() => start(async () => { await setSlotRecipe(plan.id, day, meal, f.id); setPick(false); })}>
                  <p className="text-[16px]">{f.title}</p>
                  <div className="mt-1 flex gap-3"><RecipeStats r={f} compact /><DrumstickRating value={f.difficulty} size={12} /></div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Heart a recipe and it will appear here.</p>
        )}
      </Sheet>
    </li>
  );
}

function SwapSheet({ slotId, current, onClose }: { slotId: string; current?: string; onClose: () => void }) {
  const [options, setOptions] = useState<{ why: string; recipe: RecipeOut }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    setOptions(null);
    setError(null);
    suggestSwaps(slotId).then(setOptions).catch((e) => setError(String(e.message ?? e)));
  }, [slotId]);
  useEffect(load, [load]);

  return (
    <Sheet open onClose={onClose} title={current ? `Instead of ${current}` : "Ideas"}>
      {error && <p className="text-clay">{error}</p>}
      {!options && !error && <p className="simmer py-6 text-muted">Finding three alternatives…</p>}
      {options && (
        <ul className="divide-y divide-line border-y border-line">
          {options.map((o, i) => (
            <li key={i} className="py-5">
              <Chip tone="olive">{o.why}</Chip>
              <h3 className="mt-3 text-[20px] font-normal leading-snug tracking-normal">{o.recipe.title}</h3>
              <p className="mt-1 text-[14px] text-muted">{o.recipe.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <RecipeStats r={o.recipe} compact />
                <DrumstickRating value={o.recipe.difficulty} size={13} />
                <span className="text-[12px] text-muted">≈ {money(o.recipe.est_cost)}</span>
              </div>
              <Button size="sm" className="mt-4" disabled={pending} onClick={() => start(async () => { await applySwap(slotId, o.recipe); onClose(); })}>
                Use this
              </Button>
            </li>
          ))}
        </ul>
      )}
      {options && <button className="mt-5 text-[14px] text-muted underline underline-offset-4" onClick={load}>Show three more</button>}
    </Sheet>
  );
}
