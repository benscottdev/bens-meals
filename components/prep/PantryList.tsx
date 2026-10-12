"use client";
import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { removePantryItem, savePantryItem } from "@/app/actions";
import { Button, Section } from "@/components/kitchen/ui";

const STAPLES = ["olive oil", "salt", "black pepper", "plain flour", "white sugar", "rice", "soy sauce", "garlic", "stock cubes", "dried oregano", "ground cumin", "paprika", "honey", "vinegar"];

export function PantryList({ items }: { items: { id: string; name: string; is_staple: boolean }[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const have = new Set(items.map((i) => i.name.toLowerCase()));
  const suggestions = STAPLES.filter((s) => !have.has(s));
  return (
    <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
      <Section title="Add to the cupboard" className="space-y-4 lg:col-span-5">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) start(async () => { await savePantryItem(name.trim(), true); setName(""); }); }}>
        <input className="field" placeholder="Add a staple…" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={pending}>Add</Button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} className="steel rounded-full px-3 py-1 text-sm" onClick={() => start(() => savePantryItem(s, true))}>+ {s}</button>
          ))}
        </div>
      )}
      </Section>
      <Section title={`In the cupboard (${items.length})`} className="lg:col-span-7">
        <ul className="divide-y divide-line md:columns-2 md:gap-x-10 md:divide-y-0">
          {items.map((i) => (
            <li key={i.id} className="flex break-inside-avoid items-center gap-3 border-line py-3 md:border-b">
              <span className="flex-1">{i.name}</span>
              {i.is_staple && <span className="eyebrow">staple</span>}
              <button aria-label={`Remove ${i.name}`} onClick={() => start(() => removePantryItem(i.id))} className="text-muted"><X size={16} /></button>
            </li>
          ))}
          {!items.length && <li className="py-6 text-center text-muted">Empty cupboard.</li>}
        </ul>
      </Section>
    </div>
  );
}
