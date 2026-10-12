import type { SupabaseClient } from "@supabase/supabase-js";
import { DAYS, type Day, type Ingredient, type Settings } from "@/lib/types";

/** UTC Date for a wall-clock time on a YYYY-MM-DD date in an IANA timezone. */
export function zonedTime(date: string, hhmm: string, tz: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

export function dayDate(weekStart: string, day: Day, offset = 0): string {
  const d = new Date(`${weekStart}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + DAYS.indexOf(day) + offset);
  return d.toISOString().slice(0, 10);
}

const minus = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.max(0, h * 60 + m - mins);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

type DinnerRow = {
  id: string;
  day: Day;
  leftover_of: string | null;
  skipped: boolean;
  recipe_id: string | null;
  recipes: { title: string; prep_minutes: number; cook_minutes: number; ingredients: Ingredient[] } | null;
};

export async function scheduleReminders(db: SupabaseClient, userId: string, planId: string, weekStart: string, s: Settings) {
  const tz = s.timezone;
  const { data } = await db.from("plan_slots")
    .select("id, day, leftover_of, skipped, recipe_id, recipes(title, prep_minutes, cook_minutes, ingredients)")
    .eq("plan_id", planId).eq("meal_type", "dinner");
  const dinners = (data ?? []) as unknown as DinnerRow[];

  const rows: { kind: string; title: string; body: string; url: string; fire_at: string }[] = [
    {
      kind: "order_groceries", title: "Time to order groceries 🛒",
      body: "Your list for the week is ready.", url: "/shop",
      fire_at: zonedTime(dayDate(weekStart, "mon", -1), "18:00", tz).toISOString(),
    },
    {
      kind: "plan_week", title: "Plan next week?",
      body: "Tap to generate next week's meals.", url: "/plan?next=1",
      fire_at: zonedTime(dayDate(weekStart, "sun"), "10:00", tz).toISOString(),
    },
  ];
  if (s.prep_day) {
    rows.push({
      kind: "prep", title: "Meal prep day 🥡", body: "Your prep timeline is ready.", url: "/prep",
      fire_at: zonedTime(dayDate(weekStart, s.prep_day), "09:30", tz).toISOString(),
    });
  }
  for (const d of dinners) {
    if (d.skipped || d.leftover_of || !d.recipes) continue;
    const total = d.recipes.prep_minutes + d.recipes.cook_minutes;
    rows.push({
      kind: "start_cooking", title: `Start dinner: ${d.recipes.title}`,
      body: `${total} min to have it on the table at ${s.dinner_time}.`, url: `/recipes/${d.recipe_id}/cook`,
      fire_at: zonedTime(dayDate(weekStart, d.day), minus(s.dinner_time, total + 5), tz).toISOString(),
    });
    // Meat bought on the weekend will be in the freezer by Wednesday.
    const meat = d.recipes.ingredients.find((i) => i.aisle === "Meat & Seafood");
    if (meat && DAYS.indexOf(d.day) >= 2) {
      rows.push({
        kind: "defrost", title: `Defrost the ${meat.name.toLowerCase()} 🧊`,
        body: `Move it to the fridge for tomorrow's ${d.recipes.title}.`, url: `/recipes/${d.recipe_id}`,
        fire_at: zonedTime(dayDate(weekStart, d.day, -1), "20:00", tz).toISOString(),
      });
    }
  }

  await db.from("reminders").delete().eq("plan_id", planId).is("sent_at", null);
  const now = Date.now();
  const future = rows.filter((r) => Date.parse(r.fire_at) > now);
  if (future.length) await db.from("reminders").insert(future.map((r) => ({ ...r, user_id: userId, plan_id: planId })));
}
