"use client";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/kitchen/ui";
import { prettyQty } from "@/lib/shopping/aggregate";
import { AISLES, type ShoppingItem } from "@/lib/types";

/** Shopping list on a share link. Ticks are kept on the viewer's own device only. */
export function SharedList({ token, items }: { token: string; items: ShoppingItem[] }) {
  const key = `shared-ticks-${token}`;
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { setTicked(new Set(JSON.parse(localStorage.getItem(key) ?? "[]"))); } catch {}
  }, [key]);
  const toggle = (id: string) => setTicked((t) => {
    const x = new Set(t);
    if (x.has(id)) x.delete(id); else x.add(id);
    try { localStorage.setItem(key, JSON.stringify([...x])); } catch {}
    return x;
  });
  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    items.filter((i) => !i.have_it).forEach((i) => map.set(i.aisle, [...(map.get(i.aisle) ?? []), i]));
    const order = [...AISLES] as string[];
    const rank = (x: string) => (order.includes(x) ? order.indexOf(x) : order.length);
    return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b));
  }, [items]);
  const qty = (i: ShoppingItem) => (i.qty == null ? "" : i.unit && /^(g|ml)$/.test(i.unit) ? prettyQty(Number(i.qty), i.unit) : `${Number(i.qty)} ${i.unit ?? ""}`.trim());

  return (
    <div className="gap-x-12 md:columns-2 2xl:columns-3">
      {groups.map(([aisle, list]) => (
        <section key={aisle} className="mb-10 break-inside-avoid">
          <h3 className="mb-2 text-[1.05rem] font-normal tracking-normal">{aisle}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {list.map((i) => {
              const on = ticked.has(i.id);
              return (
                <li key={i.id}>
                  <button onClick={() => toggle(i.id)} className="flex w-full items-center gap-4 py-3 text-left" aria-pressed={on}>
                    <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-ink bg-ink text-paper" : "border-line-strong")}>
                      {on && <Check size={12} strokeWidth={2} />}
                    </span>
                    <span className={cn("min-w-0 flex-1", on && "text-muted line-through")}>
                      <span className="block leading-tight">{i.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">{qty(i)}{i.pack && <> · buy {i.packs > 1 ? `${i.packs} × ` : ""}{i.pack}</>}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
