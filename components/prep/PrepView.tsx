"use client";
import { RefreshCw, Snowflake, Refrigerator } from "lucide-react";
import { useState, useTransition } from "react";
import { regeneratePrep } from "@/app/actions";
import { Bench, Button, Chip, cn } from "@/components/kitchen/ui";
import type { Prep } from "@/lib/claude/schemas";
import { DAY_LABEL } from "@/lib/types";

const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export function PrepView({ planId, prep }: { planId: string; prep: Prep }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Bench className="grid grid-cols-3 divide-x divide-line p-0 text-center">
        <div className="py-3"><div className="text-3xl font-light">{Math.round(prep.total_minutes / 6) / 10}h</div><div className="eyebrow">all up</div></div>
        <div className="py-3"><div className="text-3xl font-light">{prep.containers}</div><div className="eyebrow">containers</div></div>
        <div className="py-3"><div className="text-3xl font-light">{prep.storage.length}</div><div className="eyebrow">dishes</div></div>
      </Bench>

      <Bench>
        <h2 className="mb-3 text-2xl">The run sheet</h2>
        <ol className="relative space-y-1 border-l border-olive/40 pl-5">
          {prep.steps.map((s, i) => (
            <li key={i}>
              <button className="w-full py-2 text-left" onClick={() => setDone((d) => { const x = new Set(d); if (x.has(i)) x.delete(i); else x.add(i); return x; })}>
                <span className={cn("absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-olive", done.has(i) ? "bg-olive" : "bg-bench")} />
                <span className="eyebrow mr-2 tabular-nums">{clock(s.at_minute)}</span>
                <span className={cn(done.has(i) && "text-muted line-through")}>{s.text}</span>
                {s.recipes.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{s.recipes.map((r) => <Chip key={r}>{r}</Chip>)}</span>}
              </button>
            </li>
          ))}
        </ol>
      </Bench>

      <Bench>
        <h2 className="mb-3 text-2xl">Storing it</h2>
        <ul className="divide-y divide-line">
          {prep.storage.map((s, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              {s.where === "freezer" ? <Snowflake size={18} strokeWidth={1.4} className="mt-0.5 text-olive" /> : <Refrigerator size={18} strokeWidth={1.4} className="mt-0.5 text-olive" />}
              <div className="flex-1">
                <div className="text-[16px] leading-snug">{s.recipe}</div>
                <div className="text-sm text-muted">{s.where === "freezer" ? "Freezer" : "Fridge"} · eat by {DAY_LABEL[s.eat_by]}{s.note ? ` · ${s.note}` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      </Bench>
      <Button variant="ghost" className="w-full" disabled={pending} onClick={() => start(async () => { await regeneratePrep(planId); })}>
        <RefreshCw size={14} /> {pending ? "Re-planning…" : "Re-plan prep session"}
      </Button>
    </div>
  );
}
