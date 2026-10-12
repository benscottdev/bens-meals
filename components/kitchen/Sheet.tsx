"use client";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/** Bottom sheet on phones, centred panel on wider screens. */
export function Sheet({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 sm:items-center" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto border-t border-line bg-paper px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-ink sm:rounded-[2px] sm:border ${wide ? "max-w-2xl" : "max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-2xl leading-tight">{title}</h2>
          <button onClick={onClose} className="-mr-1 p-1 text-muted hover:text-ink" aria-label="Close"><X size={20} strokeWidth={1.4} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
