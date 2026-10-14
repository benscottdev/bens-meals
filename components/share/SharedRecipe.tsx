import { DrumstickRating } from "@/components/kitchen/Drumsticks";
import { RecipeStats, Section } from "@/components/kitchen/ui";
import { scaleQty } from "@/lib/shopping/aggregate";
import { MEAL_LABEL, type Recipe } from "@/lib/types";

/** Read-only recipe for share links: everything needed to cook it, nothing that needs an account. */
export function SharedRecipe({ r, serves, heading = "h2" }: { r: Recipe; serves?: number; heading?: "h1" | "h2" }) {
  const n = serves && serves > 0 ? serves : r.servings;
  const factor = n / r.servings;
  const H = heading;
  return (
    <article id={`r-${r.id}`} className="scroll-mt-8">
      <p className="eyebrow">{MEAL_LABEL[r.meal_type]}{r.cuisine ? ` · ${r.cuisine}` : ""}</p>
      <H className={heading === "h1" ? "mt-3 text-[2.4rem] leading-[1.06] md:text-[3.4rem]" : "mt-2 text-[1.9rem] font-light leading-[1.1]"}>{r.title}</H>
      {r.description && <p className="mt-3 text-[16px] text-muted">{r.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <RecipeStats r={r} />
        <DrumstickRating value={r.difficulty} size={16} showLabel />
      </div>
      <div className="mt-8 grid gap-x-16 gap-y-10 lg:grid-cols-12">
        <Section title="Ingredients" action={<span className="text-[13px] text-muted">{n} serves</span>} className="lg:col-span-5">
          <ul className="divide-y divide-line">
            {r.ingredients.map((i, k) => (
              <li key={k} className="flex items-baseline gap-3 py-2.5">
                <span className="w-20 shrink-0 text-right font-medium tabular-nums">{scaleQty(i.qty, i.unit, factor)}</span>
                <span>{i.name}{i.note && <span className="text-muted">, {i.note}</span>}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Method" className="lg:col-span-7">
          <ol className="space-y-5">
            {r.steps.map((s, k) => (
              <li key={k} className="flex gap-5">
                <span className="w-6 shrink-0 text-[15px] leading-relaxed text-muted tabular-nums">{k + 1}</span>
                <p className="text-[16px] leading-relaxed">{s.text}{s.minutes ? <span className="ml-1 text-xs text-muted">({s.minutes} min)</span> : null}</p>
              </li>
            ))}
          </ol>
          {r.source_url && <a href={r.source_url} target="_blank" rel="noreferrer" className="mt-6 block text-sm text-olive underline">Original recipe ↗</a>}
        </Section>
      </div>
    </article>
  );
}
