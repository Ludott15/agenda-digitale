import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "./permissions";
import type { Profile } from "./types";

export { isAdmin, canEditCovers, canEditDishes } from "./permissions";

const PROFILE_COLUMNS = "id, full_name, email, role, is_chef, active, created_at";

/**
 * Carica il profilo dell'utente della sessione corrente.
 * Usa getUser() (valida il token col server). Ritorna null se non loggato o inattivo.
 */
export async function loadProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.active) return null;
  return data as Profile;
}

/** Profilo corrente per la request (deduplicato con cache di React). */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  return loadProfile(supabase);
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isAdmin(profile)) redirect("/agenda");
  return profile;
}
