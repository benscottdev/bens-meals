"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/kitchen/ui";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/plan";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);
  const supabase = createClient();
  const switchTo = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    const callback = (to: string) => `${location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message); else router.replace(next);
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback("/onboarding") } });
      if (error) setError(error.message);
      // Supabase hides "already registered" behind a fake success with no identities.
      else if (data.user && !data.user.identities?.length) setError("That email already has an account. Use “Forgot password” to set one.");
      else if (data.session) router.replace("/onboarding");
      else setNotice("Check your email to confirm, then sign in here.");
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/reset") });
      if (error) setError(error.message); else setNotice("Check your email for a reset link.");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-[85vh] flex-col justify-center">
      <p className="eyebrow">Ben&apos;s Meals</p>
      <h1 className="mt-4 text-[2.8rem] leading-[1.05]">Dinner, sorted.<br /><span className="text-muted">Shopping, sorted.</span></h1>
      <form onSubmit={submit} className="mt-12 space-y-5">
        <label className="block space-y-2">
          <span className="eyebrow">Email</span>
          <input type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== "forgot" && (
          <label className="block space-y-2">
            <span className="eyebrow">Password</span>
            <input type="password" required minLength={8} className="field" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </label>
        )}
        <Button size="lg" className="w-full" disabled={busy}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </Button>
      </form>
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}
      {notice && <p className="mt-4 text-sm text-olive">{notice}</p>}
      <div className="mt-8 flex justify-between text-[14px] text-muted">
        <button type="button" className="hover:text-ink" onClick={() => switchTo(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Have an account? Sign in" : "Create account"}
        </button>
        {mode === "forgot"
          ? <button type="button" className="hover:text-ink" onClick={() => switchTo("signin")}>Back to sign in</button>
          : <button type="button" className="hover:text-ink" onClick={() => switchTo("forgot")}>Forgot password</button>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}
