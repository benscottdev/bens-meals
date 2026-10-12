"use client";
import { Camera, CookingPot, Link2, Refrigerator } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fridgeRescue, importRecipe, saveRecipes } from "@/app/actions";
import { DrumstickRating } from "@/components/kitchen/Drumsticks";
import { Sheet } from "@/components/kitchen/Sheet";
import { Bench, Button, RecipeStats } from "@/components/kitchen/ui";
import type { RecipeOut } from "@/lib/claude/schemas";

function Preview({ recipes, onSave, saving }: { recipes: RecipeOut[]; onSave: (r: RecipeOut) => void; saving: boolean }) {
  return (
    <ul className="mt-4 grid gap-3">
      {recipes.map((r, i) => (
        <li key={i} className="bench p-4">
          <h3 className="text-2xl leading-tight">{r.title}</h3>
          <p className="text-sm text-muted">{r.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><DrumstickRating value={r.difficulty} size={14} /><RecipeStats r={r} compact /></div>
          <Button className="mt-3 w-full" size="sm" disabled={saving} onClick={() => onSave(r)}>Save to my recipes</Button>
        </li>
      ))}
    </ul>
  );
}

export function RecipeTools() {
  const router = useRouter();
  const [mode, setMode] = useState<"import" | "rescue" | null>(null);
  const [url, setUrl] = useState("");
  const [have, setHave] = useState("");
  const [meal, setMeal] = useState("dinner");
  const [results, setResults] = useState<RecipeOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const run = (fn: () => Promise<RecipeOut[]>) => {
    setError(null); setResults(null);
    start(async () => { try { setResults(await fn()); } catch (e) { setError((e as Error).message); } });
  };
  const save = (r: RecipeOut) => start(async () => {
    const [id] = await saveRecipes([r], mode === "import" ? "imported" : "generated");
    setMode(null); router.push(`/recipes/${id}`);
  });
  const onPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(",")[1];
      const media_type = (file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg") as "image/jpeg";
      run(async () => [await importRecipe({ image: { media_type, data } })]);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button className="bench flex items-center gap-3 p-4 text-left" onClick={() => { setMode("rescue"); setResults(null); }}>
          <Refrigerator size={22} strokeWidth={1.3} className="text-olive" />
          <span><span className="block text-[16px] leading-snug">Fridge rescue</span><span className="text-xs text-muted">Use up what you&apos;ve got</span></span>
        </button>
        <button className="bench flex items-center gap-3 p-4 text-left" onClick={() => { setMode("import"); setResults(null); }}>
          <Link2 size={22} strokeWidth={1.3} className="text-olive" />
          <span><span className="block text-[16px] leading-snug">Import</span><span className="text-xs text-muted">From a link or photo</span></span>
        </button>
      </div>

      <Sheet open={mode === "rescue"} onClose={() => setMode(null)} title="What needs using up?">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => fridgeRescue(have, meal)); }}>
          <textarea className="field min-h-20" placeholder="half a cabbage, 2 chicken thighs, sour cream…" value={have} onChange={(e) => setHave(e.target.value)} required />
          <div className="flex gap-2">
            <select className="field !w-auto" value={meal} onChange={(e) => setMeal(e.target.value)}>
              <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option>
            </select>
            <Button className="flex-1" disabled={busy}>{busy ? "Thinking…" : "Find ideas"}</Button>
          </div>
        </form>
        {busy && !results && <p className="mt-4 flex items-center gap-2 text-muted"><CookingPot className="simmer text-olive" size={18} /> Rummaging through the fridge…</p>}
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
        {results && <Preview recipes={results} onSave={save} saving={busy} />}
      </Sheet>

      <Sheet open={mode === "import"} onClose={() => setMode(null)} title="Import a recipe">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => [await importRecipe({ url })]); }}>
          <input type="url" required className="field" placeholder="https://www.recipetineats.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button disabled={busy}>Go</Button>
        </form>
        <Bench className="mt-3 p-0">
          <label className="flex cursor-pointer items-center justify-center gap-2 p-4 text-sm">
            <Camera size={18} strokeWidth={1.4} className="text-olive" /> Snap a cookbook page
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
        </Bench>
        {busy && !results && <p className="mt-4 flex items-center gap-2 text-muted"><CookingPot className="simmer text-olive" size={18} /> Reading the recipe…</p>}
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
        {results && <Preview recipes={results} onSave={save} saving={busy} />}
      </Sheet>
    </>
  );
}
