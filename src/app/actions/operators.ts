"use server";

import { revalidatePath } from "next/cache";
import { OperatorInput, OperatorUpdateInput, PasswordInput } from "@/lib/validation";
import { authorize, dbFail, fail, invalidInput, isUuid } from "@/lib/action-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/permissions";
import type { ActionResult } from "@/lib/types";

/** Crea l'utente Auth (service role, email già confermata) e il profilo. Rollback dell'utente se il profilo fallisce. */
export async function createOperator(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = OperatorInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { full_name, email, password, role, is_chef } = parsed.data;

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (authError || !created?.user) {
    if (/already|registered|exists/i.test(authError?.message ?? "")) {
      return fail("Esiste già un utente con questa email.");
    }
    return fail("Impossibile creare l'utente. Controlla i dati e riprova.");
  }

  const id = created.user.id;
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id, full_name, email, role, is_chef, active: true });
  if (profileError) {
    await admin.auth.admin.deleteUser(id);
    return dbFail(profileError);
  }

  revalidatePath("/operatori");
  return { ok: true, data: { id } };
}

/** Modifica nome, ruolo, flag chef e stato attivo. Non è possibile modificare l'amministratore. */
export async function updateOperator(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Operatore non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = OperatorUpdateInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { data: target, error: readError } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (readError) return dbFail(readError);
  if (!target) return fail("Operatore non trovato.");
  if (target.role === "admin") return fail("Non è possibile modificare l'amministratore.");

  const { error } = await auth.supabase.from("profiles").update(parsed.data).eq("id", id);
  if (error) return dbFail(error);

  // Allinea l'accesso Auth allo stato attivo: un operatore disattivato non può più autenticarsi.
  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: parsed.data.active ? "none" : "876000h",
  });
  if (banError) {
    return fail("Dati aggiornati, ma non è stato possibile aggiornare l'accesso dell'operatore. Riprova.");
  }

  revalidatePath("/operatori");
  return { ok: true, data: undefined };
}

/** Imposta una nuova password (service role). Non consentito per l'amministratore. */
export async function resetOperatorPassword(id: string, password: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Operatore non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = PasswordInput.safeParse({ password });
  if (!parsed.success) return invalidInput(parsed.error);

  const { data: target, error: readError } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (readError) return dbFail(readError);
  if (!target) return fail("Operatore non trovato.");
  if (target.role === "admin") return fail("Non è possibile reimpostare la password dell'amministratore da qui.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: parsed.data.password });
  if (error) return fail("Impossibile aggiornare la password. Riprova.");

  return { ok: true, data: undefined };
}
