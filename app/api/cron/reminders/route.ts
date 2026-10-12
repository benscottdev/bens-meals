import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push";
import { createServiceClient } from "@/lib/supabase/server";

/** Every 15 min (Vercel cron): push any reminders that are due. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const db = createServiceClient();
  const { data: due } = await db.from("reminders").select("*").is("sent_at", null)
    .lte("fire_at", new Date().toISOString()).gte("fire_at", new Date(Date.now() - 6 * 3600e3).toISOString()).limit(100);
  let sent = 0;
  for (const r of due ?? []) {
    sent += await sendPush(db, r.user_id, { title: r.title, body: r.body ?? undefined, url: r.url ?? "/plan", tag: r.kind });
    await db.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
  }
  return NextResponse.json({ due: due?.length ?? 0, sent });
}
