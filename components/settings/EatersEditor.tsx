"use client";
import { Plus, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteEater, saveEater } from "@/app/actions";
import { Sheet } from "@/components/kitchen/Sheet";
import { Bench, Button, Chip, cn } from "@/components/kitchen/ui";
import { MEAL_LABEL, MEALS, type Eater } from "@/lib/types";
import { ChipToggle } from "./ChipToggle";

const ALLERGENS = ["peanuts", "tree nuts", "dairy", "eggs", "gluten", "shellfish", "fish", "soy", "sesame"];
const DISLIKES = ["mushrooms", "olives", "coriander", "eggplant", "seafood", "spicy food", "blue cheese", "capers"];
const DIETS = ["", "vegetarian", "vegan", "pescatarian", "halal", "low-carb", "keto", "high-protein"];
const blank: Partial<Eater> & { name: string } = {
  name: "", age_group: "adult", appetite: 1, kcal_target: null, protein_target: null,
  allergies: [], dislikes: [], diet: null, meals: [...MEALS],
};

export function EatersEditor({ eaters }: { eaters: Eater[] }) {
  const [edit, setEdit] = useState<(Partial<Eater> & { name: string }) | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Eater>(k: K, v: Eater[K]) => setEdit((e) => (e ? { ...e, [k]: v } : e));

  return (
    <Bench className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[1.35rem] font-normal tracking-[-0.015em]">Who&apos;s eating</h2>
        <Button size="sm" variant="outline" onClick={() => setEdit({ ...blank })}><Plus size={14} /> Add</Button>
      </div>
      {!eaters.length && <p className="text-sm text-muted">Add yourself (and anyone you cook for) so portions, macros and exclusions are right.</p>}
      <ul className="divide-y divide-line">
        {eaters.map((e) => (
          <li key={e.id}>
            <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => { setEdit(e); setAdvanced(!!(e.kcal_target || e.protein_target)); }}>
              <span className="grid h-10 w-10 place-items-center rounded-full border border-olive/50 bg-sand text-[16px] text-muted">{e.name[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[17px] leading-tight">{e.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {e.diet && <Chip tone="olive">{e.diet}</Chip>}
                  {e.allergies.map((a) => <Chip key={a} tone="clay">no {a}</Chip>)}
                  {e.kcal_target && <Chip>{e.kcal_target} kcal</Chip>}
                  {e.protein_target && <Chip>{e.protein_target}g protein</Chip>}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "Add someone"}>
        {edit && (
          <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); start(async () => { await saveEater(edit); setEdit(null); }); }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 space-y-1"><span className="eyebrow">Name</span>
                <input required className="field" value={edit.name} onChange={(e) => set("name", e.target.value)} /></label>
              <label className="space-y-1"><span className="eyebrow">Age</span>
                <select className="field" value={edit.age_group} onChange={(e) => set("age_group", e.target.value as Eater["age_group"])}>
                  <option value="adult">Adult</option><option value="teen">Teen</option><option value="child">Child</option><option value="toddler">Toddler</option>
                </select></label>
              <label className="space-y-1"><span className="eyebrow">Appetite</span>
                <select className="field" value={edit.appetite} onChange={(e) => set("appetite", Number(e.target.value))}>
                  <option value={0.5}>Small (½)</option><option value={0.75}>Light (¾)</option><option value={1}>Normal</option><option value={1.25}>Hearty</option><option value={1.5}>Big (1½)</option>
                </select></label>
              <label className="col-span-2 space-y-1"><span className="eyebrow">Diet</span>
                <select className="field" value={edit.diet ?? ""} onChange={(e) => set("diet", e.target.value || null)}>
                  {DIETS.map((d) => <option key={d} value={d}>{d || "No particular diet"}</option>)}
                </select></label>
            </div>
            <div className="space-y-1.5"><span className="eyebrow">Allergies — never included</span>
              <ChipToggle options={ALLERGENS} value={edit.allergies ?? []} onChange={(v) => set("allergies", v)} allowCustom /></div>
            <div className="space-y-1.5"><span className="eyebrow">Dislikes — avoided</span>
              <ChipToggle options={DISLIKES} value={edit.dislikes ?? []} onChange={(v) => set("dislikes", v)} allowCustom /></div>
            <div className="space-y-1.5"><span className="eyebrow">Eats</span>
              <div className="flex gap-2">
                {MEALS.map((m) => {
                  const on = edit.meals?.includes(m);
                  return (
                    <button key={m} type="button" onClick={() => set("meals", on ? edit.meals!.filter((x) => x !== m) : [...(edit.meals ?? []), m])}
                      className={cn("flex-1 rounded-[2px] border py-2 text-xs", on ? "border-ink bg-ink text-[#f5f2ec]" : "steel")}>{MEAL_LABEL[m]}</button>
                  );
                })}
              </div></div>
            <button type="button" className="eyebrow underline" onClick={() => setAdvanced((a) => !a)}>{advanced ? "Hide" : "Show"} calorie & protein targets</button>
            {advanced && (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1"><span className="eyebrow">kcal / day</span>
                  <input className="field" type="number" inputMode="numeric" value={edit.kcal_target ?? ""} onChange={(e) => set("kcal_target", e.target.value ? Number(e.target.value) : null)} /></label>
                <label className="space-y-1"><span className="eyebrow">Protein g / day</span>
                  <input className="field" type="number" inputMode="numeric" value={edit.protein_target ?? ""} onChange={(e) => set("protein_target", e.target.value ? Number(e.target.value) : null)} /></label>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {edit.id && <Button type="button" variant="ghost" className="text-clay" onClick={() => start(async () => { await deleteEater(edit.id!); setEdit(null); })}>Remove</Button>}
              <Button className="flex-1" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        )}
      </Sheet>
      {!eaters.length && <UserRound className="hidden" />}
    </Bench>
  );
}
