import { dayDate, zonedTime } from "@/lib/plan/reminders";
import { createServiceClient } from "@/lib/supabase/server";
import { MEAL_LABEL, type Day, type MealType } from "@/lib/types";

const TIMES: Record<MealType, string> = { breakfast: "07:30", lunch: "12:30", dinner: "18:30", snack: "15:30" };
const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** Subscribable .ics feed of the last 2 and next plans. The token is the secret. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[0-9a-f-]{36}$/.test(token)) return new Response("Not found", { status: 404 });
  const db = createServiceClient();
  const { data: s } = await db.from("settings").select("user_id, timezone, dinner_time").eq("calendar_token", token).maybeSingle();
  if (!s) return new Response("Not found", { status: 404 });

  const { data: plans } = await db.from("meal_plans").select("id, week_start").eq("user_id", s.user_id)
    .eq("status", "ready").order("week_start", { ascending: false }).limit(3);
  const origin = new URL(req.url).origin;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bens Meals//EN", "X-WR-CALNAME:Ben's Meals", "CALSCALE:GREGORIAN"];
  for (const p of plans ?? []) {
    const { data: slots } = await db.from("plan_slots").select("id, day, meal_type, skipped, leftover_of, recipe_id, recipes(title, prep_minutes, cook_minutes)").eq("plan_id", p.id);
    for (const sl of slots ?? []) {
      const r = sl.recipes as unknown as { title: string; prep_minutes: number; cook_minutes: number } | null;
      if (!r || sl.skipped) continue;
      const time = sl.meal_type === "dinner" ? s.dinner_time : TIMES[sl.meal_type as MealType];
      const start = zonedTime(dayDate(p.week_start, sl.day as Day), time, s.timezone);
      const end = new Date(start.getTime() + 30 * 60e3);
      lines.push(
        "BEGIN:VEVENT", `UID:${sl.id}@bensmeals`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
        `SUMMARY:${esc(`${MEAL_LABEL[sl.meal_type as MealType]}: ${r.title}${sl.leftover_of ? " (leftovers)" : ""}`)}`,
        `URL:${origin}/recipes/${sl.recipe_id}`, `DESCRIPTION:${esc(`${r.prep_minutes + r.cook_minutes} min · ${origin}/recipes/${sl.recipe_id}`)}`,
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
