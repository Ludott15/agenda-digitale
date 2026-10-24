import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import type { Profile } from "@/lib/types";
import { assertOk } from "./shared";

/** Elenco operatori (solo admin: per gli altri ritorna array vuoto). */
export async function getOperators(): Promise<Profile[]> {
  const me = await getCurrentProfile();
  if (!me || !isAdmin(me)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_chef, active, created_at")
    .order("role")
    .order("full_name");
  assertOk(error);
  return (data ?? []) as Profile[];
}
