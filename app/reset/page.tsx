"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bench, Button, PageTitle } from "@/components/kitchen/ui";
import { createClient } from "@/lib/supabase/client";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { createClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user)); }, []);
  if (signedIn === false) {
    return (
      <>
        <PageTitle sub="Account">New password</PageTitle>
        <Bench className="space-y-3">
          <p>This page needs the link from your password-reset email. It may have expired or been opened in a different browser.</p>
          <Link href="/login" className="text-olive underline">Request a new link</Link>
        </Bench>
      </>
    );
  }
  return (
    <>
      <PageTitle sub="Account">New password</PageTitle>
      <Bench>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          const { error } = await createClient().auth.updateUser({ password });
          setBusy(false);
          if (error) setError(error.message); else router.replace("/plan");
        }}>
          <input type="password" required minLength={8} autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button className="w-full" disabled={busy}>Save password</Button>
        </form>
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      </Bench>
    </>
  );
}
