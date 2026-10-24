"use server";

import { revalidatePath } from "next/cache";
import { ClientInput } from "@/lib/validation";
import { authorize, dbFail, fail, invalidInput, isUuid } from "@/lib/action-utils";
import { isAdmin } from "@/lib/permissions";
import type { ActionResult } from "@/lib/types";

export async function createClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = ClientInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { data, error } = await auth.supabase
    .from("clients")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) return dbFail(error);

  revalidatePath("/clienti");
  return { ok: true, data: { id: data.id as string } };
}

export async function updateClient(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Cliente non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = ClientInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await auth.supabase.from("clients").update(parsed.data).eq("id", id);
  if (error) return dbFail(error);

  revalidatePath("/clienti");
  revalidatePath(`/clienti/${id}`);
  return { ok: true, data: undefined };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Cliente non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("clients").delete().eq("id", id);
  if (error?.code === "23503") {
    return fail("Impossibile eliminare: il cliente ha prenotazioni collegate.");
  }
  if (error) return dbFail(error);

  revalidatePath("/clienti");
  return { ok: true, data: undefined };
}
