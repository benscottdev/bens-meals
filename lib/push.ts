import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

/** Sends to every device the user has subscribed; prunes dead subscriptions. Returns devices reached. */
export async function sendPush(db: SupabaseClient, userId: string, payload: PushPayload): Promise<number> {
  configure();
  const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", userId);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", code, e);
      }
    }),
  );
  return sent;
}
