import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; middleware refreshes the session instead.
          }
        },
      },
    },
  );
}

/** Service-role client: bypasses RLS. Only for cron jobs and background generation. */
export function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type SessionUser = { id: string; email: string | null };

/**
 * The signed-in user, verified locally from the JWT (the project uses asymmetric signing keys, so no round-trip to the
 * auth server). Cached per request so a page's many data loaders share one check.
 */
export const currentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user: SessionUser | null = data?.claims?.sub ? { id: data.claims.sub, email: (data.claims.email as string) ?? null } : null;
  return { supabase, user };
});

export async function requireUser() {
  const { supabase, user } = await currentUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}
