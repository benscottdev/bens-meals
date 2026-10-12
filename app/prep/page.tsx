import Link from "next/link";
import { Button, Empty, PageTitle } from "@/components/kitchen/ui";
import { PrepView } from "@/components/prep/PrepView";
import { getActivePlan, session, settingsOrOnboard } from "@/lib/data";
import type { Prep } from "@/lib/claude/schemas";
import { DAY_LABEL } from "@/lib/types";

export default async function PrepPage() {
  const settings = await settingsOrOnboard();
  const { plan } = await getActivePlan();
  const { supabase } = await session();
  const { data: prep } = plan
    ? await supabase.from("prep_sessions").select("*").eq("plan_id", plan.id).maybeSingle()
    : { data: null };
  return (
    <>
      <PageTitle sub={settings.prep_day ? `${DAY_LABEL[settings.prep_day]} session` : "Batch cooking"}>Meal prep</PageTitle>
      {prep ? (
        <PrepView planId={plan!.id} prep={prep.timeline as Prep} />
      ) : (
        <Empty title={settings.prep_day ? "Nothing to prep this week" : "No prep day set"}>
          <p className="text-sm text-muted">
            {settings.prep_day ? "None of this week's meals need batch cooking. Turn on prep lunches in Kitchen settings to batch weekday lunches." : "Pick a prep day in Kitchen settings and the next plan will include a combined cooking timeline."}
          </p>
          <Link href="/settings"><Button variant="outline" size="sm">Kitchen settings</Button></Link>
        </Empty>
      )}
    </>
  );
}
