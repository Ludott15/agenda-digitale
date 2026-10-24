import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/auth";
import type { ActionResult, Profile } from "./types";

// Helper condivisi dalle Server Actions. Non vanno in file "use server" (lì si esportano solo funzioni async).

export type Authorized =
  | { ok: true; supabase: SupabaseClient; profile: Profile }
  | { ok: false; error: string };

/** Verifica sessione, profilo attivo e permesso; ritorna il client con la sessione utente. */
export async function authorize(
  allowed: (p: Profile) => boolean,
  denied = "Operazione non consentita.",
): Promise<Authorized> {
  const supabase = await createClient();
  const profile = await loadProfile(supabase);
  if (!profile) return { ok: false, error: "Sessione non valida o utente non abilitato." };
  if (!allowed(profile)) return { ok: false, error: denied };
  return { ok: true, supabase, profile };
}

/** Errori Zod → fieldErrors (chiave = path puntato, "_form" per errori globali). */
export function invalidInput<T = never>(error: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "Controlla i campi evidenziati.", fieldErrors };
}

export function fail<T = never>(error: string): ActionResult<T> {
  return { ok: false, error };
}

// Codici SQLSTATE che portano messaggi già leggibili (RAISE EXCEPTION ... USING errcode).
const USER_FACING_CODES = new Set(["P0001", "P0002", "22023", "42501"]);

/** Traduce un errore PostgREST/Postgres in un messaggio per l'utente. */
export function dbFail<T = never>(
  err: { code?: string; message: string } | null,
  fallback = "Operazione non riuscita. Riprova.",
): ActionResult<T> {
  if (!err) return fail(fallback);
  if (err.code === "23503") return fail("Operazione non possibile: l'elemento è collegato ad altri dati.");
  if (err.code === "23505") return fail("Esiste già un elemento con questi dati.");
  if (err.code && USER_FACING_CODES.has(err.code)) return fail(err.message);
  console.error("[db]", err);
  return fail(fallback);
}

const uuidParse = z.uuid();

/** Valida un identificativo ricevuto dal client. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidParse.safeParse(value).success;
}
