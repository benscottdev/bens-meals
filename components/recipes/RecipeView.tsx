"use client";
import { Ban, ChefHat, Heart, Minus, Plus, QrCode, Share2, Smartphone, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useState, useTransition } from "react";
import { deleteRecipe, sendToPhone, setFeedback } from "@/app/actions";
import { DrumstickRating } from "@/components/kitchen/Drumsticks";
import { Sheet } from "@/components/kitchen/Sheet";
import { Button, Chip, RecipeStats, Section, cn } from "@/components/kitchen/ui";
import { prettyQty } from "@/lib/shopping/aggregate";
import { MEAL_LABEL, money, type Recipe } from "@/lib/types";

type Feedback = { favourite: boolean; rating: number | null; never_again: boolean; notes: string | null; cooked_count: number } | null;

export function scaleQty(qty: number, unit: string, factor: number) {
  const q = qty * factor;
  if (["g", "ml"].includes(unit)) return prettyQty(Math.round(q), unit);
  const nice = Math.round(q * 4) / 4;
  const frac: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
  const whole = Math.floor(nice), part = (nice - whole).toFixed(2).replace(/0$/, "");
  return `${whole || ""}${frac[part] ?? (part !== "0.0" && part !== "0" ? part.slice(1) : "")} ${unit}`.trim();
}

/** `initialServes` comes from the week plan (?serves=) so quantities match who is eating, leftovers included. */
export function RecipeView({ r, fb, initialServes }: { r: Recipe; fb: Feedback; initialServes?: number }) {
  const [serves, setServes] = useState(initialServes ?? r.servings);
  const [have, setHave] = useState<Set<number>>(new Set());
  const [qr, setQr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fav, setFav] = useState(fb?.favourite ?? false);
  const [rating, setRating] = useState(fb?.rating ?? 0);
  const [, start] = useTransition();
  const factor = serves / r.servings;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const share = async () => {
    const url = location.href;
    if (navigator.share) await navigator.share({ title: r.title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); flash("Link copied"); }
  };

  return (
    <article>
      <header className="mb-12">
        <p className="eyebrow">{MEAL_LABEL[r.meal_type]}{r.cuisine ? ` · ${r.cuisine}` : ""}</p>
        <h1 className="mt-3 text-[2.4rem] leading-[1.06] md:text-[3.4rem]">{r.title}</h1>
        {r.description && <p className="mt-4 text-[17px] text-muted md:text-[19px]">{r.description}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <DrumstickRating value={r.difficulty} size={20} showLabel />
          <RecipeStats r={r} />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {r.tags.map((t) => <Chip key={t}>{t}</Chip>)}
          {r.meal_prep_friendly && <Chip tone="olive">meal prep · {r.fridge_days} days</Chip>}
          {r.freezer_friendly && <Chip tone="olive">freezes well</Chip>}
        </div>
      </header>

      <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-5">
          <div className="space-y-3">
            <Link href={`/recipes/${r.id}/cook${serves !== r.servings ? `?serves=${serves}` : ""}`} className="block">
              <Button size="lg" className="w-full"><ChefHat size={18} strokeWidth={1.5} /> Start cooking</Button>
            </Link>
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" className="flex-col !gap-1 !py-3" onClick={() => { setFav(!fav); start(() => setFeedback(r.id, { favourite: !fav })); }} aria-pressed={fav}>
                <Heart size={18} strokeWidth={1.4} className={cn(fav && "fill-clay text-clay")} /> {fav ? "Loved" : "Love"}
              </Button>
              <Button variant="outline" size="sm" className="flex-col !gap-1 !py-3" onClick={async () => {
                const n = await sendToPhone(r.title, `/recipes/${r.id}/cook`, `${r.prep_minutes + r.cook_minutes} min · tap to start cooking`);
                flash(n ? "Sent to your phone" : "Turn on notifications in Settings first");
              }}><Smartphone size={18} strokeWidth={1.4} /> Phone</Button>
              <Button variant="outline" size="sm" className="flex-col !gap-1 !py-3" onClick={share}><Share2 size={18} strokeWidth={1.4} /> Share</Button>
              <Button variant="outline" size="sm" className="flex-col !gap-1 !py-3" onClick={async () => setQr(await QRCode.toDataURL(location.href, { margin: 1, width: 280, color: { dark: "#252321", light: "#f5f2ec" } }))}>
                <QrCode size={18} strokeWidth={1.4} /> QR
              </Button>
            </div>
          </div>

          <Section
            title="Ingredients"
            action={
              <div className="steel flex items-center rounded-full">
                <button className="p-2" onClick={() => setServes(Math.max(1, serves - 1))} aria-label="Fewer serves"><Minus size={14} /></button>
                <span className="min-w-16 text-center text-sm">{serves} serves</span>
                <button className="p-2" onClick={() => setServes(serves + 1)} aria-label="More serves"><Plus size={14} /></button>
              </div>
            }
          >
            <ul className="divide-y divide-line">
              {r.ingredients.map((i, n) => (
                <li key={n}>
                  <label className="flex cursor-pointer items-baseline gap-3 py-2.5">
                    <input type="checkbox" className="h-4 w-4 translate-y-0.5 accent-[var(--olive)]" checked={have.has(n)}
                      onChange={() => setHave((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; })} />
                    <span className={cn("w-20 shrink-0 text-right font-medium tabular-nums", have.has(n) && "text-muted line-through")}>{scaleQty(i.qty, i.unit, factor)}</span>
                    <span className={cn(have.has(n) && "text-muted line-through")}>{i.name}{i.note && <span className="text-muted">, {i.note}</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
            {r.est_cost != null && <p className="mt-3 text-right text-xs text-muted">≈ {money(r.est_cost * factor)} of ingredients</p>}
          </Section>

          {r.kcal != null && (
            <Section title="Nutrition" action={<span className="text-[13px] text-muted">per serve</span>}>
              <div className="grid grid-cols-4 divide-x divide-line text-center">
                {[["kcal", r.kcal], ["protein", `${r.protein_g}g`], ["carbs", `${r.carbs_g}g`], ["fat", `${r.fat_g}g`]].map(([l, v]) => (
                  <div key={l} className="py-1"><div className="text-2xl font-light">{v}</div><div className="eyebrow">{l}</div></div>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-14 lg:col-span-7">
          <Section title="Method">
            <ol className="space-y-5">
              {r.steps.map((s, n) => (
                <li key={n} className="flex gap-5">
                  <span className="w-6 shrink-0 text-[15px] leading-relaxed text-muted tabular-nums">{n + 1}</span>
                  <p className="text-[16px] leading-relaxed">{s.text}{s.minutes ? <span className="ml-1 text-xs text-muted">({s.minutes} min)</span> : null}</p>
                </li>
              ))}
            </ol>
            {r.source_url && <a href={r.source_url} target="_blank" rel="noreferrer" className="mt-6 block text-sm text-olive underline">Original recipe ↗</a>}
          </Section>

          <Section title="How was it?" className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} aria-label={`${n} stars`} onClick={() => { setRating(n); start(() => setFeedback(r.id, { rating: n, cooked: !fb?.cooked_count && rating === 0 })); flash("Thanks — noted for future plans"); }}>
                  <Star size={28} strokeWidth={1.2} className={cn(n <= rating ? "fill-olive text-olive" : "text-line-strong")} />
                </button>
              ))}
            </div>
            <textarea className="field min-h-16 text-sm" placeholder="Notes for next time (e.g. 'double the garlic')" defaultValue={fb?.notes ?? ""}
              onBlur={(e) => start(() => setFeedback(r.id, { notes: e.target.value }))} />
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" className="text-clay" onClick={() => start(async () => { await setFeedback(r.id, { never_again: true, favourite: false }); flash("Won't suggest this again"); })}>
                <Ban size={14} /> Never again
              </Button>
              <Button variant="ghost" size="sm" className="text-muted" onClick={() => confirm("Delete this recipe?") && start(() => deleteRecipe(r.id))}><Trash2 size={14} /> Delete</Button>
            </div>
          </Section>
        </div>
      </div>

      <Sheet open={!!qr} onClose={() => setQr(null)} title="Scan with your phone">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR code for this recipe" className="mx-auto" />}
      </Sheet>
      {toast && <div className="fixed inset-x-0 bottom-28 z-50 mx-auto w-fit rounded-[2px] bg-ink px-4 py-2 text-sm text-[#f5f2ec] shadow-lg">{toast}</div>}
    </article>
  );
}
