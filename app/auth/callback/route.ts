import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** True when the session came from a password-recovery link (JWT `amr` claim). */
function isRecovery(accessToken: string) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    return (payload.amr ?? []).some((a: { method?: string }) => a.method === "recovery");
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  // nextUrl.origin reports plain "localhost" in dev; keep the host the browser actually used.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = host ? `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${host}` : url.origin;
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, origin));
  const linkError = url.searchParams.get("error_description");
  if (linkError) return fail(linkError);

  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: (type ?? "email") as EmailOtpType })
      : { data: { session: null }, error: new Error("That link is missing its code.") };
  if (error || !data.session) {
    return fail(error?.message.includes("code verifier")
      ? "Open the email link in the same browser you requested it from."
      : (error?.message ?? "That link didn't work — request a new one."));
  }
  const recovery = type === "recovery" || isRecovery(data.session.access_token);
  const next = recovery ? "/reset" : url.searchParams.get("next") ?? "/plan";
  return NextResponse.redirect(new URL(next, origin));
}
