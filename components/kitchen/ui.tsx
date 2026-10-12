import { clsx } from "clsx";
import { ArrowRight, Clock, Dumbbell, Flame, Package, Snowflake } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { Recipe } from "@/lib/types";

export const cn = clsx;

export function Bench({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bench py-6", className)} {...p} />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };
export function Button({ variant = "primary", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[2px] font-normal transition-colors disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" && "px-3.5 py-2 text-[13px]",
        size === "md" && "py-3 text-[14px]",
        size === "lg" && "px-6 py-4 text-[15px]",
        variant === "primary" && "bg-ink text-paper hover:bg-black",
        variant === "outline" && "steel text-ink hover:border-ink",
        variant === "ghost" && "text-ink hover:bg-ink/[0.04]",
        variant === "danger" && "bg-clay text-paper hover:brightness-95",
        className,
      )}
      {...p}
    />
  );
}

/** Text link with an arrow — the house call-to-action. */
export function Arrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("group inline-flex items-center gap-2 border-b border-ink pb-0.5 text-[15px]", className)}>
      {children}
      <ArrowRight size={15} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
    </span>
  );
}

export function Chip({ children, tone = "plain", className }: { children: ReactNode; tone?: "plain" | "olive" | "sand" | "clay"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px]",
        tone === "plain" && "border border-line-strong text-muted",
        tone === "olive" && "bg-olive-soft text-olive",
        tone === "sand" && "bg-sand text-ink/70",
        tone === "clay" && "border border-clay/40 text-clay",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RecipeStats({ r, compact = false }: { r: Pick<Recipe, "prep_minutes" | "cook_minutes" | "kcal" | "protein_g" | "meal_prep_friendly" | "freezer_friendly">; compact?: boolean }) {
  const s = "inline-flex items-center gap-1";
  const icon = { size: compact ? 12 : 14, strokeWidth: 1.4 };
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-muted", compact ? "text-[12px]" : "text-[13px]")}>
      <span className={s} title="Prep + cook time"><Clock {...icon} />{r.prep_minutes + r.cook_minutes} min</span>
      {r.kcal != null && <span className={s} title="Calories per serve"><Flame {...icon} />{r.kcal}</span>}
      {r.protein_g != null && <span className={s} title="Protein per serve"><Dumbbell {...icon} />{r.protein_g}g</span>}
      {r.meal_prep_friendly && <span className={s} title="Meal-prep friendly"><Package {...icon} />{!compact && "prep"}</span>}
      {r.freezer_friendly && <span className={s} title="Freezer friendly"><Snowflake {...icon} />{!compact && "freezes"}</span>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 border-t border-line py-10">
      <h2 className="text-3xl">{title}</h2>
      {children}
    </div>
  );
}

export function PageTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8">
      {sub && <p className="eyebrow mb-3">{sub}</p>}
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[2.6rem] leading-[1.05]">{children}</h1>
        {action}
      </div>
    </div>
  );
}
