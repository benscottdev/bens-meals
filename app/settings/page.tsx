import { BarChart3, ChevronRight, LogOut, Package } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { Button, PageTitle, Section } from "@/components/kitchen/ui";
import { EatersEditor } from "@/components/settings/EatersEditor";
import { PhoneCard } from "@/components/settings/PhoneCard";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { session, settingsOrOnboard } from "@/lib/data";
import type { Eater } from "@/lib/types";

export default async function SettingsPage() {
  const settings = await settingsOrOnboard();
  const { supabase, user } = await session();
  const [{ data: eaters }, { data: tok }] = await Promise.all([
    supabase.from("eaters").select("*").order("sort"),
    supabase.from("settings").select("calendar_token").eq("user_id", user.id).single(),
  ]);
  return (
    <>
      <PageTitle sub={user.email ?? undefined}>Your kitchen</PageTitle>
      <div className="grid gap-x-16 gap-y-14 lg:grid-cols-2">
        <Section title="Your data">
        <div className="divide-y divide-line border-b border-line">
          {[{ href: "/pantry", icon: Package, label: "Pantry & staples" }, { href: "/settings/stats", icon: BarChart3, label: "Spending & history" }].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 py-4">
              <Icon size={18} strokeWidth={1.4} className="text-olive" />
              <span className="flex-1 text-[17px]">{label}</span>
              <ChevronRight size={16} className="text-muted" />
            </Link>
          ))}
        </div>
        <form action={signOut} className="mt-4"><Button variant="ghost" className="-ml-4 text-muted"><LogOut size={14} /> Sign out</Button></form>
        </Section>
        <EatersEditor eaters={(eaters ?? []) as Eater[]} />
        <PhoneCard calendarToken={tok?.calendar_token ?? ""} />
      </div>
      <div className="mt-14">
        <h2 className="mb-8 text-[2rem] font-light">Planning preferences</h2>
        <SettingsForm initial={settings} />
      </div>
    </>
  );
}
