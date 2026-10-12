"use client";
import { Check, Copy, ExternalLink, Plus, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addExtraItem, optimiseList, setActualTotal, setItemPrice, toggleItem } from "@/app/actions";
import { Sheet } from "@/components/kitchen/Sheet";
import { Button, cn } from "@/components/kitchen/ui";
import { prettyQty, storeSearchUrl } from "@/lib/shopping/aggregate";
import { createClient } from "@/lib/supabase/client";
import { AISLES, STORE_LABEL, money, type MealPlan, type ShoppingItem } from "@/lib/types";

const qtyLabel = (i: ShoppingItem) => (i.qty == null ? "" : i.unit && /^(g|ml)$/.test(i.unit) ? prettyQty(Number(i.qty), i.unit) : `${Number(i.qty)} ${i.unit ?? ""}`.trim());

export function ShoppingList({ plan, items: initial }: { plan: MealPlan; items: ShoppingItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [hideDone, setHideDone] = useState(false);
  const [priceFor, setPriceFor] = useState<ShoppingItem | null>(null);
  const [receipt, setReceipt] = useState(false);
  const [extra, setExtra] = useState("");
  const [copied, setCopied] = useState(false);
  const [tidy, setTidy] = useState<{ busy: boolean; merges?: string[]; error?: string }>({ busy: false });
  const [, start] = useTransition();
  useEffect(() => setItems(initial), [initial]);

  // Ticks made on another device show up live.
  useEffect(() => {
    const db = createClient();
    const ch = db.channel(`shop-${plan.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shopping_items", filter: `plan_id=eq.${plan.id}` },
        (p) => setItems((xs) => xs.map((x) => (x.id === p.new.id ? { ...x, ...(p.new as ShoppingItem) } : x))))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [plan.id]);

  const toBuy = items.filter((i) => !i.have_it);
  const total = toBuy.reduce((t, i) => t + Number(i.est_price ?? 0), 0);
  const left = toBuy.filter((i) => !i.checked).length;
  const owned = items.filter((i) => i.have_it);
  const saved = owned.reduce((t, i) => t + Number(i.est_price ?? 0), 0);
  const groups = useMemo(() => {
    const order = [...AISLES] as string[];
    const map = new Map<string, ShoppingItem[]>();
    items.forEach((i) => map.set(i.aisle, [...(map.get(i.aisle) ?? []), i]));
    const rank = (x: string) => (order.includes(x) ? order.indexOf(x) : order.length);
    return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b));
  }, [items]);

  const flip = (i: ShoppingItem, field: "checked" | "have_it") => {
    const set = (v: boolean) => setItems((xs) => xs.map((x) => (x.id === i.id ? { ...x, [field]: v } : x)));
    set(!i[field]);
    start(async () => {
      try { await toggleItem(i.id, field, !i[field]); } catch { set(i[field]); } // offline or signed out: undo
    });
  };

  const copy = async () => {
    const text = groups.map(([aisle, list]) => {
      const lines = list.filter((i) => !i.have_it).map((i) => `• ${i.name}${i.pack ? ` — ${i.packs > 1 ? `${i.packs} × ` : ""}${i.pack}` : ""}`);
      return lines.length ? `${aisle}\n${lines.join("\n")}` : "";
    }).filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4 border-t border-line pt-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="eyebrow">{STORE_LABEL[plan.store]} · {left} to get</div>
            <div className={cn("text-[2rem] font-light leading-tight tabular-nums", total > plan.budget && "text-clay")}>{money(total)}</div>
          </div>
          <div className="text-right text-sm text-muted">
            budget {money(plan.budget)}
            {plan.actual_total != null && <div className="font-medium text-ink">paid {money(plan.actual_total)}</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy list"}</Button>
          <Button variant="outline" size="sm" onClick={() => setHideDone(!hideDone)}>{hideDone ? "Show all" : "Hide ticked"}</Button>
          <Button variant="outline" size="sm" onClick={() => setReceipt(true)}><Receipt size={14} /> Receipt total</Button>
          <Button variant="outline" size="sm" disabled={tidy.busy} onClick={async () => {
            setTidy({ busy: true });
            try { const r = await optimiseList(plan.id); setTidy({ busy: false, merges: r.merges }); router.refresh(); }
            catch (e) { setTidy({ busy: false, error: (e as Error).message }); }
          }}>{tidy.busy ? "Combining…" : "Combine similar items"}</Button>
        </div>
        {tidy.merges && (
          <div className="text-[13px] text-olive">
            {tidy.merges.length ? <>Combined: {tidy.merges.join(" · ")}</> : "Nothing to combine — every staple is already a single product."}
          </div>
        )}
        {tidy.error && <p className="text-[13px] text-clay">{tidy.error}</p>}
        {owned.length > 0 && (
          <p className="text-[13px] text-olive">Already have {owned.length} item{owned.length > 1 ? "s" : ""} · {money(saved)} off the total</p>
        )}
        <p className="text-xs text-muted">Tap <span className="text-ink">Have</span> on anything already in the cupboard — it stays on the list but comes off the total. Tap a price to correct it; it&apos;s remembered next week.</p>
      </section>

      {groups.map(([aisle, list]) => {
        const shown = list.filter((i) => !(hideDone && i.checked));
        if (!shown.length) return null;
        return (
          <section key={aisle}>
            <h2 className="eyebrow mb-1">{aisle}</h2>
            <ul className="divide-y divide-line border-y border-line">
              {shown.map((i) => {
                const link = storeSearchUrl(plan.store, i.name);
                return (
                  <li key={i.id} className="flex items-center gap-4 py-3.5">
                    <button onClick={() => flip(i, "checked")} aria-label={`Tick ${i.name}`} aria-pressed={i.checked}
                      className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", i.checked ? "border-ink bg-ink text-paper" : "border-line-strong")}>
                      {i.checked && <Check size={12} strokeWidth={2} />}
                    </button>
                    <div className={cn("min-w-0 flex-1", (i.checked || i.have_it) && "opacity-50")}>
                      <div className={cn("leading-tight", i.checked && "line-through")}>{i.name}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {i.have_it ? "Already have it" : <>{qtyLabel(i)}{i.pack && <> · buy {i.packs > 1 ? `${i.packs} × ` : ""}{i.pack}</>}</>}
                      </div>
                    </div>
                    <button onClick={() => flip(i, "have_it")} aria-pressed={i.have_it} aria-label={`${i.have_it ? "Need" : "Already have"} ${i.name}`}
                      className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[12px] transition-colors", i.have_it ? "border-olive bg-olive text-paper" : "border-line-strong text-muted hover:border-ink hover:text-ink")}>
                      {i.have_it ? "Have ✓" : "Have"}
                    </button>
                    <button className={cn("w-14 shrink-0 text-right text-sm tabular-nums underline decoration-dotted underline-offset-4", i.have_it && "text-muted line-through no-underline")} onClick={() => setPriceFor(i)}>
                      {money(i.est_price)}
                    </button>
                    {link && <a href={link} target="_blank" rel="noreferrer" aria-label={`Find ${i.name} at ${STORE_LABEL[plan.store]}`} className="text-muted hover:text-ink"><ExternalLink size={14} strokeWidth={1.4} /></a>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!extra.trim()) return; start(async () => { await addExtraItem(plan.id, extra.trim()); setExtra(""); router.refresh(); }); }}>
        <input className="field" placeholder="Add something else (toilet paper, coffee…)" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <Button variant="outline" aria-label="Add item"><Plus size={16} /></Button>
      </form>

      <Sheet open={!!priceFor} onClose={() => setPriceFor(null)} title={priceFor?.name ?? ""}>
        {priceFor && (
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const price = Number(f.get("price"));
            setItems((xs) => xs.map((x) => (x.id === priceFor.id ? { ...x, est_price: price, pack: String(f.get("pack") || x.pack), price_source: "manual" } : x)));
            start(() => setItemPrice(priceFor.id, price, String(f.get("pack") || "") || null));
            setPriceFor(null);
          }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1"><span className="eyebrow">Price paid (total)</span><input name="price" type="number" step="0.01" inputMode="decimal" className="field" defaultValue={priceFor.est_price ?? ""} autoFocus required /></label>
              <label className="space-y-1"><span className="eyebrow">Pack</span><input name="pack" className="field" defaultValue={priceFor.pack ?? ""} /></label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { flip(priceFor, "have_it"); setPriceFor(null); }}>
                {priceFor.have_it ? "Actually I need it" : "I already have it"}
              </Button>
              <Button className="flex-1">Save price</Button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet open={receipt} onClose={() => setReceipt(false)} title="What did the shop cost?">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("total"); start(() => setActualTotal(plan.id, v ? Number(v) : null)); setReceipt(false); }}>
          <input name="total" type="number" step="0.01" inputMode="decimal" className="field" defaultValue={plan.actual_total ?? ""} placeholder="e.g. 142.35" autoFocus />
          <Button>Save</Button>
        </form>
        <p className="mt-2 text-xs text-muted">Tracks real spend vs budget in Spending & history.</p>
      </Sheet>
    </div>
  );
}
