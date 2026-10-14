"use client";
import { Check, Copy, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";
import { getShareLink, revokeShareLink, setShareIncludesList, type ShareLink } from "@/app/actions";
import { Sheet } from "@/components/kitchen/Sheet";
import { Button } from "@/components/kitchen/ui";

/** Makes (or reuses) a read-only public link and offers the phone share sheet, copy and a QR code. */
export function ShareSheet({ open, onClose, target, title, isWeek = false }: {
  open: boolean; onClose: () => void; target: { planId?: string; recipeId?: string }; title: string; isWeek?: boolean;
}) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const url = link && typeof window !== "undefined" ? `${location.origin}/s/${link.token}` : "";
  const local = typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(location.hostname);

  useEffect(() => {
    if (!open || link) return;
    setError(null);
    getShareLink(target).then(setLink).catch((e) => setError((e as Error).message));
  }, [open, link, target]);
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#252321", light: "#f5f2ec" } }).then(setQr);
  }, [url]);

  const share = async () => {
    if (navigator.share) await navigator.share({ title, text: title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); setCopied(true); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={isWeek ? "Share this week" : "Share recipe"}>
      <p className="-mt-3 mb-6 text-sm text-muted">
        Anyone with the link can view {isWeek ? "the meals and every recipe" : "this recipe"} — no account needed. They can&apos;t change anything.
      </p>
      {error && <p className="mb-4 text-sm text-clay">{error}</p>}
      {!link && !error && <p className="simmer text-muted">Making a link…</p>}
      {link && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <input readOnly value={url} onFocus={(e) => e.target.select()} className="field text-[13px]" />
            <Button variant="outline" aria-label="Copy link" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <Button size="lg" className="w-full" onClick={share}><Share2 size={16} strokeWidth={1.5} /> Send link…</Button>

          {isWeek && (
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={link.include_list} disabled={pending}
                onChange={(e) => { const v = e.target.checked; setLink({ ...link, include_list: v }); start(() => setShareIncludesList(link.token, v)); }} />
              Include the shopping list
            </label>
          )}

          {qr && (
            <div className="flex items-center gap-5 border-t border-line pt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code for the share link" className="h-28 w-28" />
              <p className="text-[13px] text-muted">Scan with your phone&apos;s camera to open it there.</p>
            </div>
          )}
          {local && <p className="text-[13px] text-clay">You&apos;re on a local dev address, so this link only opens on this computer. It&apos;ll work for others once the app is deployed.</p>}

          <button className="text-[13px] text-muted underline underline-offset-4 hover:text-clay" disabled={pending}
            onClick={() => start(async () => { await revokeShareLink(link.token); setLink(null); onClose(); })}>
            Turn this link off
          </button>
        </div>
      )}
    </Sheet>
  );
}
