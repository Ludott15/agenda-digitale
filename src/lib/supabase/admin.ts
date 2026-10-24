import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client con service role: bypassa RLS. Usare SOLO dopo aver verificato il ruolo admin
 * (es. creazione/gestione operatori in src/app/actions/operators.ts).
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
