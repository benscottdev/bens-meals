import { Dashboard } from "@/components/home/Dashboard";
import { getPlan, session, settingsOrOnboard } from "@/lib/data";
import { nextWeekStart, todayISO, weekStart } from "@/lib/types";

/** Minutes past midnight right now in Ben's timezone. */
function nowMinutes(tz: string) {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

export default async function Home() {
  const settings = await settingsOrOnboard();
  const { supabase, user } = await session();
  const tz = settings.timezone;
  const today = todayISO(tz);
  const week = weekStart(today);

  const [{ plan, slots }, next, recent, reminders] = await Promise.all([
    getPlan(week),
    supabase.from("meal_plans").select("id").eq("user_id", user.id).eq("week_start", nextWeekStart()).neq("status", "archived").maybeSingle(),
    supabase.from("meal_plans").select("week_start, budget, est_total, actual_total").eq("user_id", user.id)
      .eq("status", "ready").lt("week_start", week).order("week_start", { ascending: false }).limit(4),
    supabase.from("reminders").select("id, title, fire_at, url").eq("user_id", user.id).is("sent_at", null)
      .gte("fire_at", new Date().toISOString()).order("fire_at").limit(4),
  ]);
  const [items, prep] = plan
    ? await Promise.all([
        supabase.from("shopping_items").select("checked, have_it").eq("plan_id", plan.id),
        supabase.from("prep_sessions").select("id").eq("plan_id", plan.id).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  return (
    <Dashboard
      settings={settings} today={today} nowMins={nowMinutes(tz)} plan={plan} slots={slots}
      nextPlanned={!!next.data} recent={recent.data ?? []} reminders={reminders.data ?? []}
      shopping={items.data ?? []} hasPrep={!!prep.data}
    />
  );
}
