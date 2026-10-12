import { Heart } from "lucide-react";
import Link from "next/link";
import { DrumstickRating } from "@/components/kitchen/Drumsticks";
import { Chip, RecipeStats } from "@/components/kitchen/ui";
import { MEAL_LABEL, type Recipe } from "@/lib/types";

export function RecipeCard({ r, favourite }: { r: Recipe; favourite?: boolean }) {
  return (
    <Link href={`/recipes/${r.id}`} className="bench block p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{MEAL_LABEL[r.meal_type]}{r.cuisine ? ` · ${r.cuisine}` : ""}</span>
        {favourite && <Heart size={15} className="fill-clay text-clay" />}
      </div>
      <h3 className="mt-1.5 text-[19px] font-normal leading-snug tracking-normal">{r.title}</h3>
      {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <DrumstickRating value={r.difficulty} size={15} />
        <RecipeStats r={r} compact />
        {r.source === "web" && <Chip>from the web</Chip>}
      </div>
    </Link>
  );
}
