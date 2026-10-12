import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/reset", "/dev", "/auth", "/api/cron", "/api/calendar", "/manifest.webmanifest", "/sw.js", "/icons"];

export async function middleware(request: NextRequest) {
  const linkCode = request.nextUrl.searchParams.get("code");
  if ((linkCode || request.nextUrl.searchParams.get("error_description")) && !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // Verifies the JWT locally against the project's public signing key (refreshing it if expired) — no auth round-trip.
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && !PUBLIC.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
