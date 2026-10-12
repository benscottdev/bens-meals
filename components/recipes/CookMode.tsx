"use client";
import { ChevronLeft, ChevronRight, ListChecks, Timer, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setFeedback } from "@/app/actions";
import { Sheet } from "@/components/kitchen/Sheet";
import type { Recipe } from "@/lib/types";
import { scaleQty } from "./RecipeView";

type RunningTimer = { step: number; label: string; endsAt: number };

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = () => navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    get();
    const onVis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release(); };
  }, []);
}

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {}
  navigator.vibrate?.([300, 150, 300]);
}

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function CookMode({ r, serves }: { r: Recipe; serves?: number }) {
  const factor = (serves ?? r.servings) / r.servings;
  useWakeLock();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showIng, setShowIng] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(Date.now());
  const fired = useRef(new Set<number>());
  const touch = useRef<number | null>(null);
  const done = step >= r.steps.length;
  const s = r.steps[step];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    timers.forEach((t) => {
      if (t.endsAt <= now && !fired.current.has(t.endsAt)) { fired.current.add(t.endsAt); chime(); }
    });
  }, [now, timers]);

  const go = (d: number) => setStep((x) => Math.max(0, Math.min(r.steps.length, x + d)));

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink text-[#f5f2ec]"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); touch.current = null; }}
    >
      <div className="flex items-center justify-between  pt-[calc(env(safe-area-inset-top)+1rem)]">
        <Link href={`/recipes/${r.id}`} aria-label="Exit cook mode" className="p-1"><X size={22} strokeWidth={1.4} /></Link>
        <p className="eyebrow !text-[#c9c2a7]">{done ? "Bon appétit" : `Step ${step + 1} of ${r.steps.length}`}</p>
        <button onClick={() => setShowIng(true)} aria-label="Ingredients" className="p-1"><ListChecks size={22} strokeWidth={1.4} /></button>
      </div>
      <div className="mx-5 mt-3 flex gap-1">
        {r.steps.map((_, i) => <div key={i} className={`h-px flex-1 ${i <= step ? "bg-[#c9c2a7]" : "bg-white/15"}`} />)}
      </div>

      <div className="flex flex-1 flex-col justify-center px-7">
        {done ? (
          <div className="text-center">
            <h1 className="text-5xl">Dinner is served.</h1>
            <p className="mt-3 text-[#f5f2ec]/70">{r.title}</p>
            <button className="mt-8 rounded-[2px] bg-[#c9c2a7] px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-olive"
              onClick={async () => { await setFeedback(r.id, { cooked: true }); router.push(`/recipes/${r.id}`); }}>
              Mark as cooked & rate
            </button>
          </div>
        ) : (
          <>
            <p className="font-display text-[2rem] leading-snug sm:text-[2.4rem]">{s.text}</p>
            {s.minutes ? (
              <button
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-[#c9c2a7]/60 py-2.5 text-[#c9c2a7]"
                onClick={() => setTimers((t) => [...t.filter((x) => x.step !== step), { step, label: `Step ${step + 1}`, endsAt: Date.now() + s.minutes! * 60e3 }])}
              >
                <Timer size={18} strokeWidth={1.4} /> Start {s.minutes} min timer
              </button>
            ) : null}
          </>
        )}
      </div>

      {timers.length > 0 && (
        <div className="flex flex-wrap gap-2  pb-3">
          {timers.map((t) => {
            const left = t.endsAt - now;
            return (
              <button key={t.endsAt} onClick={() => setTimers((x) => x.filter((y) => y !== t))}
                className={`rounded-full px-3 py-1.5 text-sm tabular-nums ${left <= 0 ? "animate-pulse bg-clay text-white" : "bg-white/10"}`}>
                {t.label} · {left <= 0 ? "done!" : mmss(left)} ✕
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <button className="flex items-center justify-center gap-2 py-6 disabled:opacity-30" disabled={step === 0} onClick={() => go(-1)}>
          <ChevronLeft size={20} /> Back
        </button>
        <button className="flex items-center justify-center gap-2 bg-white/5 py-6 disabled:opacity-30" disabled={done} onClick={() => go(1)}>
          {step === r.steps.length - 1 ? "Finish" : "Next"} <ChevronRight size={20} />
        </button>
      </div>

      <Sheet open={showIng} onClose={() => setShowIng(false)} title={`Ingredients · ${serves ?? r.servings} serves`}>
        <ul className="divide-y divide-line text-ink">
          {r.ingredients.map((i, n) => (
            <li key={n} className="flex gap-3 py-2"><span className="w-20 shrink-0 text-right font-medium">{scaleQty(i.qty, i.unit, factor)}</span><span>{i.name}</span></li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
