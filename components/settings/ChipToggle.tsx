"use client";
import { useState } from "react";
import { cn } from "@/components/kitchen/ui";

/** Multi-select chips with an optional free-text "add your own". */
export function ChipToggle({ options, value, onChange, allowCustom = false }: { options: string[]; value: string[]; onChange: (v: string[]) => void; allowCustom?: boolean }) {
  const [custom, setCustom] = useState("");
  const all = [...new Set([...options, ...value])];
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((o) => (
        <button
          type="button" key={o} onClick={() => toggle(o)} aria-pressed={value.includes(o)}
          className={cn("rounded-full border px-3 py-1 text-sm", value.includes(o) ? "border-ink bg-ink text-[#f5f2ec]" : "steel text-ink")}
        >
          {o}
        </button>
      ))}
      {allowCustom && (
        <input
          className="field !w-36 !rounded-full !py-1 text-sm" placeholder="+ add" value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) {
              e.preventDefault();
              onChange([...value, custom.trim().toLowerCase()]);
              setCustom("");
            }
          }}
        />
      )}
    </div>
  );
}
