"use client";
import { BellRing, CalendarPlus, Check, Copy, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { savePushSubscription, sendToPhone } from "@/app/actions";
import { Bench, Button } from "@/components/kitchen/ui";

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PhoneCard({ calendarToken }: { calendarToken: string }) {
  const [status, setStatus] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(location.origin);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setStatus("unsupported");
    if (Notification.permission === "denied") return setStatus("denied");
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setStatus(s ? "on" : "off"));
  }, []);

  async function enable() {
    setMsg(null);
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setStatus("denied");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await savePushSubscription(json, /iPhone|Android/.test(navigator.userAgent) ? "phone" : "computer");
    setStatus("on");
  }

  const ics = `${origin.replace(/^https?/, "webcal")}/api/calendar/${calendarToken}.ics`;

  return (
    <Bench className="space-y-4">
      <h2 className="text-[1.35rem] font-normal tracking-[-0.015em]">Phone & reminders</h2>
      <p className="text-sm text-muted">
        On your iPhone: open this site in Safari → Share → <em>Add to Home Screen</em>, open it from there, then turn on notifications.
        You&apos;ll get “send to phone” recipes, a nudge to order groceries, defrost reminders and when to start dinner.
      </p>
      {status === "unsupported" && <p className="text-sm text-clay">This browser can&apos;t do notifications. On iPhone, use the Home Screen app.</p>}
      {status === "denied" && <p className="text-sm text-clay">Notifications are blocked — allow them in your browser settings.</p>}
      <div className="flex flex-wrap gap-2">
        {status === "off" && <Button onClick={enable}><BellRing size={15} /> Turn on notifications</Button>}
        {status === "on" && (
          <Button variant="outline" onClick={async () => {
            const n = await sendToPhone("It works ✨", "/plan", "Notifications from Ben's Meals are on.");
            setMsg(n ? `Sent to ${n} device${n > 1 ? "s" : ""}.` : "No devices subscribed yet.");
          }}><Smartphone size={15} /> Send a test</Button>
        )}
      </div>
      {msg && <p className="text-sm text-olive">{msg}</p>}
      <div className="brass-rule" />
      <div className="space-y-2">
        <div className="eyebrow flex items-center gap-2"><CalendarPlus size={14} /> Meals in your calendar</div>
        <div className="flex gap-2">
          <input readOnly className="field text-xs" value={ics} onFocus={(e) => e.target.select()} />
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(ics); setCopied(true); }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
        <a href={ics} className="text-sm text-olive underline">Subscribe on this device</a>
      </div>
    </Bench>
  );
}
