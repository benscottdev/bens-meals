import { DIFFICULTY_LABEL } from "@/lib/types";

function Drumstick({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* Minimal drumstick: teardrop meat tapering into a two-knuckle bone, drawn upright then tilted. */}
      <g transform="rotate(40 12 12)" strokeLinejoin="round">
        <path
          d="M10.7 15.2 10.6 18.6C8.6 18.2 7.8 20.8 9.4 21.8 10.4 22.4 11.4 22 12 21.3 12.6 22 13.6 22.4 14.6 21.8 16.2 20.8 15.4 18.2 13.4 18.6L13.3 15.2Z"
          fill="none" stroke={filled ? "var(--ink)" : "var(--line-strong)"} strokeWidth="1"
        />
        <path
          d="M12 2.5C16 2.5 18 5.5 17.6 8.8 17.2 12 14.6 13.6 13.7 15.4 12.6 16 11.4 16 10.3 15.4 9.4 13.6 6.8 12 6.4 8.8 6 5.5 8 2.5 12 2.5Z"
          fill={filled ? "var(--ink)" : "none"} stroke={filled ? "var(--ink)" : "var(--line-strong)"} strokeWidth="1"
        />
      </g>
    </svg>
  );
}

/** Difficulty out of 5, shown as little chicken drumsticks. */
export function DrumstickRating({ value, size = 18, showLabel = false }: { value: number; size?: number; showLabel?: boolean }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  const label = `Difficulty ${v}/5 — ${DIFFICULTY_LABEL[v]}`;
  return (
    <span className="inline-flex items-center gap-1" title={label} aria-label={label} role="img">
      <span className="inline-flex gap-px">
        {[1, 2, 3, 4, 5].map((n) => (
          <Drumstick key={n} filled={n <= v} size={size} />
        ))}
      </span>
      {showLabel && <span className="text-sm text-muted">{DIFFICULTY_LABEL[v]}</span>}
    </span>
  );
}

/** Interactive picker version for settings (max difficulty). */
export function DrumstickPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" onClick={() => onChange(n)}
          className="rounded-[2px] p-1 hover:bg-sand" aria-label={`${n} of 5`}
        >
          <Drumstick filled={n <= value} size={28} />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted">{DIFFICULTY_LABEL[value]}</span>
    </div>
  );
}
