"use client";
import { useState, useTransition } from "react";
import { saveSettings } from "@/app/actions";
import { DrumstickPicker } from "@/components/kitchen/Drumsticks";
import { Button, cn } from "@/components/kitchen/ui";
import { DAY_LABEL, DAYS, MEAL_LABEL, MEALS, STORE_LABEL, STORES, type Day, type MealType, type Settings } from "@/lib/types";
import { ChipToggle } from "./ChipToggle";

const EQUIPMENT = ["oven", "stovetop", "microwave", "air fryer", "slow cooker", "pressure cooker", "bbq", "blender", "rice cooker"];
const CUISINES = ["Aussie classics", "Italian", "Mexican", "Thai", "Indian", "Japanese", "Chinese", "Korean", "Middle Eastern", "Greek", "Vietnamese"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="eyebrow">{label}</div>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

type FormProps = {
  initial: Settings;
  onboarding?: boolean;
  /** Shown in a sheet: button sticks to the sheet bottom and says what happens next. */
  inSheet?: boolean;
  submitLabel?: string;
  onSaved?: () => void | Promise<void>;
};

export function SettingsForm({ initial, onboarding = false, inSheet = false, submitLabel, onSaved }: FormProps) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS((p) => ({ ...p, [k]: v })); setSaved(false); };

  const toggleMeal = (d: Day, m: MealType) => {
    const cur = s.meal_grid[d] ?? [];
    set("meal_grid", { ...s.meal_grid, [d]: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] });
  };
  const toggleColumn = (m: MealType) => {
    const allOn = DAYS.every((d) => s.meal_grid[d]?.includes(m));
    set("meal_grid", Object.fromEntries(DAYS.map((d) => {
      const cur = (s.meal_grid[d] ?? []).filter((x) => x !== m);
      return [d, allOn ? cur : [...cur, m]];
    })) as Settings["meal_grid"]);
  };
  const count = Object.values(s.meal_grid).flat().length;

  const { onboarded, ...patch } = s;
  void onboarded;
  return (
    <div className={cn("grid gap-x-16 gap-y-12", !inSheet && "lg:grid-cols-2")}>
      <section className="space-y-5 border-t border-line-strong pt-6">
        <h2 className="text-[1.35rem] font-normal tracking-[-0.015em]">Budget & shop</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weekly budget (AUD)">
            <input className="field" type="number" inputMode="decimal" min={20} step={5} value={s.weekly_budget} onChange={(e) => set("weekly_budget", Number(e.target.value))} />
          </Field>
          <Field label="Postcode" hint="For local pricing">
            <input className="field" inputMode="numeric" maxLength={4} value={s.postcode ?? ""} onChange={(e) => set("postcode", e.target.value || null)} />
          </Field>
        </div>
        <Field label="Where you shop">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STORES.map((st) => (
              <button key={st} type="button" onClick={() => set("store", st)}
                className={cn("rounded-[2px] border px-2 py-2 text-sm font-medium", s.store === st ? "border-ink bg-ink text-[#f5f2ec]" : "steel")}>
                {STORE_LABEL[st]}
              </button>
            ))}
          </div>
        </Field>
      </section>

      <section className="space-y-4 border-t border-line-strong pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[1.35rem] font-normal tracking-[-0.015em]">Meals you need</h2>
          <span className="text-sm text-muted">{count} a week</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr>
                <th />
                {MEALS.map((m) => (
                  <th key={m} className="pb-2 font-medium">
                    <button type="button" className="underline decoration-dotted" onClick={() => toggleColumn(m)}>{MEAL_LABEL[m]}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d}>
                  <td className="py-1 pr-2 text-left font-medium">{DAY_LABEL[d]}</td>
                  {MEALS.map((m) => {
                    const on = s.meal_grid[d]?.includes(m);
                    return (
                      <td key={m} className="py-1">
                        <button type="button" onClick={() => toggleMeal(d, m)} aria-pressed={on} aria-label={`${DAY_LABEL[d]} ${MEAL_LABEL[m]}`}
                          className={cn("h-9 w-full max-w-16 rounded-[2px] border", on ? "border-ink text-ink" : "border-line text-line-strong")}>
                          {on ? "✓" : "–"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Field label="Leftover nights" hint="Dinner is leftovers of an earlier dinner — less cooking, less waste.">
          <ChipToggle options={DAYS.map((d) => DAY_LABEL[d])} value={s.leftover_nights.map((d) => DAY_LABEL[d])}
            onChange={(v) => set("leftover_nights", DAYS.filter((d) => v.includes(DAY_LABEL[d])))} />
        </Field>
      </section>

      <section className="space-y-5 border-t border-line-strong pt-6">
        <h2 className="text-[1.35rem] font-normal tracking-[-0.015em]">How you cook</h2>
        <Field label={`Max weeknight cook time: ${s.max_weeknight_minutes} min`}>
          <input type="range" min={15} max={120} step={5} value={s.max_weeknight_minutes} onChange={(e) => set("max_weeknight_minutes", Number(e.target.value))} className="w-full accent-[var(--olive)]" />
        </Field>
        <Field label="Hardest you're up for">
          <DrumstickPicker value={s.max_difficulty} onChange={(v) => set("max_difficulty", v)} />
        </Field>
        <Field label="Dinner time" hint="Used for 'start cooking' reminders.">
          <input type="time" className="field !w-36" value={s.dinner_time} onChange={(e) => set("dinner_time", e.target.value)} />
        </Field>
        <Field label="Equipment"><ChipToggle options={EQUIPMENT} value={s.equipment} onChange={(v) => set("equipment", v)} allowCustom /></Field>
        <Field label="Cuisines you love" hint="Leave empty for anything."><ChipToggle options={CUISINES} value={s.cuisines} onChange={(v) => set("cuisines", v)} allowCustom /></Field>
      </section>

      <section className="space-y-5 border-t border-line-strong pt-6">
        <h2 className="text-[1.35rem] font-normal tracking-[-0.015em]">Meal prep</h2>
        <Field label="Prep day" hint="Get a combined cooking timeline and containers plan for batch meals.">
          <div className="flex flex-wrap gap-2">
            {[null, ...DAYS].map((d) => (
              <button key={d ?? "none"} type="button" onClick={() => set("prep_day", d)}
                className={cn("rounded-full border px-3 py-1 text-sm", s.prep_day === d ? "border-ink bg-ink text-[#f5f2ec]" : "steel")}>
                {d ? DAY_LABEL[d] : "No prep day"}
              </button>
            ))}
          </div>
        </Field>
        {s.prep_day && (
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-[var(--olive)]" checked={s.meal_prep_lunches} onChange={(e) => set("meal_prep_lunches", e.target.checked)} />
            <span>Batch-cook weekday lunches into containers</span>
          </label>
        )}
      </section>

      <section className="space-y-5 border-t border-line-strong pt-6">
        <h2 className="text-[1.35rem] font-normal tracking-[-0.015em]">Recipes</h2>
        <Field label="Where recipes come from">
          <div className="grid grid-cols-2 gap-2">
            {([["generate", "Claude creates them", "Fast, tailored to everything above"], ["find", "Find real recipes", "Searches the web, keeps the source link"]] as const).map(([k, t, d]) => (
              <button key={k} type="button" onClick={() => set("plan_mode", k)}
                className={cn("rounded-[2px] border p-3 text-left", s.plan_mode === k ? "border-ink bg-olive-soft" : "steel")}>
                <div className="font-medium">{t}</div><div className="text-xs text-muted">{d}</div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Anything else?" hint="e.g. 'more fish', 'no fiddly breakfasts', 'happy to eat the same lunch all week'">
          <textarea className="field min-h-20" value={s.extra_notes ?? ""} onChange={(e) => set("extra_notes", e.target.value || null)} />
        </Field>
      </section>

      <div className={cn("sticky z-10 -mx-1 bg-paper/95 px-1 py-3 backdrop-blur", inSheet ? "-bottom-5" : "bottom-16 md:bottom-0 lg:col-span-2")}>
        <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { await saveSettings(patch, onboarding); setSaved(true); await onSaved?.(); })}>
          {pending ? "Saving…" : submitLabel ?? (onboarding ? "Start planning" : saved ? "Saved" : "Save settings")}
        </Button>
      </div>
    </div>
  );
}
