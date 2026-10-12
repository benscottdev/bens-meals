import { redirect } from "next/navigation";
import { PageTitle } from "@/components/kitchen/ui";
import { EatersEditor } from "@/components/settings/EatersEditor";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { session } from "@/lib/data";
import { loadSettings } from "@/lib/plan/context";
import type { Eater } from "@/lib/types";

export default async function Onboarding() {
  const { supabase, user } = await session();
  const settings = await loadSettings(supabase, user.id);
  if (settings.onboarded) redirect("/");
  const { data: eaters } = await supabase.from("eaters").select("*").order("sort");
  return (
    <>
      <PageTitle sub="Welcome to your kitchen">Let&apos;s set the table</PageTitle>
      <p className="-mt-2 mb-5 text-[17px] text-muted">A few details once, then every week plans itself.</p>
      <div className="space-y-14">
        <EatersEditor eaters={(eaters ?? []) as Eater[]} />
        <SettingsForm initial={settings} onboarding />
      </div>
    </>
  );
}
