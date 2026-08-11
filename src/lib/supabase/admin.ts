import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses Row Level Security entirely. Server-only
// (this file must never be imported from a Client Component). Reserved for
// the admin panel's cross-user operations and Web Push delivery, which
// legitimately need to read/write data outside what RLS would allow a
// single authenticated user to touch. Every call site is expected to do
// its own is_admin()-equivalent authorization check before using this.
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
