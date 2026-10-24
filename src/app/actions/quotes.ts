"use server";

import { revalidatePath } from "next/cache";
import { QuoteInput } from "@/lib/validation";
import { authorize, dbFail, fail, invalidInput, isUuid } from "@/lib/action-utils";
import { isAdmin } from "@/lib/permissions";
import type { ActionResult } from "@/lib/types";

/** Crea il preventivo con le righe automatiche da menù e coperti (RPC create_quote: transazionale, numero progressivo). */
export async function createQuoteFromBooking(bookingId: string): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(bookingId)) return fail("Prenotazione non valida.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase.rpc("create_quote", { p_booking_id: bookingId });
  if (error || typeof data !== "string") return dbFail(error);

  revalidatePath(`/prenotazioni/${bookingId}`);
  return { ok: true, data: { id: data } };
}

export async function updateQuote(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Preventivo non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = QuoteInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { data, error } = await auth.supabase
    .from("quotes")
    .update({
      issued_at: parsed.data.issued_at,
      valid_until: parsed.data.valid_until,
      lines: parsed.data.lines,
      discount: parsed.data.discount,
      vat_rate: parsed.data.vat_rate,
      notes: parsed.data.notes,
    })
    .eq("id", id)
    .select("booking_id")
    .maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail("Preventivo non trovato.");

  revalidatePath(`/preventivi/${id}`);
  revalidatePath(`/prenotazioni/${data.booking_id}`);
  return { ok: true, data: undefined };
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Preventivo non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase
    .from("quotes")
    .delete()
    .eq("id", id)
    .select("booking_id")
    .maybeSingle();
  if (error) return dbFail(error);
  if (!data) return fail("Preventivo non trovato.");

  revalidatePath(`/prenotazioni/${data.booking_id}`);
  return { ok: true, data: undefined };
}
