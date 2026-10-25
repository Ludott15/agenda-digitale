"use server";

import { revalidatePath } from "next/cache";
import { PaymentInput, ReceiptFile, resolveReceiptType } from "@/lib/validation";
import { authorize, dbFail, fail, invalidInput, isUuid } from "@/lib/action-utils";
import { isAdmin } from "@/lib/permissions";
import { sanitizeReceiptName } from "@/lib/payment-utils";
import type { ActionResult } from "@/lib/types";

// Acconti e ricevute: solo admin. Il client è quello della sessione utente, quindi
// le policy su payments e storage.objects (is_admin()) fanno da barriera anche a livello DB.

const RECEIPTS_BUCKET = "receipts";
const SIGNED_URL_SECONDS = 120;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Aggiunge un acconto a una prenotazione, con ricevuta opzionale (foto o PDF). */
export async function addPayment(bookingId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(bookingId)) return fail("Prenotazione non valida.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = PaymentInput.safeParse({
    amount: field(formData, "amount"),
    paid_at: field(formData, "paid_at"),
    method: field(formData, "method"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) return invalidInput(parsed.error);

  // Un campo file vuoto (nessuna selezione nel browser) equivale ad assenza di ricevuta.
  const entry = formData.get("receipt");
  let receipt: File | null = null;
  if (entry instanceof File && entry.size > 0) {
    const checked = ReceiptFile.safeParse(entry);
    if (!checked.success) {
      const message = checked.error.issues[0]?.message ?? "Ricevuta non valida.";
      return { ok: false, error: message, fieldErrors: { receipt: [message] } };
    }
    receipt = checked.data;
  }

  const { supabase, profile } = auth;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) return dbFail(bookingError);
  if (!booking) return fail("Prenotazione non trovata.");

  const paymentId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("payments").insert({
    id: paymentId,
    booking_id: bookingId,
    amount: parsed.data.amount,
    paid_at: parsed.data.paid_at,
    method: parsed.data.method,
    notes: parsed.data.notes,
    created_by: profile.id,
  });
  if (insertError) return dbFail(insertError);

  if (receipt) {
    const mime = resolveReceiptType(receipt);
    if (!mime) {
      await supabase.from("payments").delete().eq("id", paymentId);
      return fail("Formato ricevuta non ammesso.");
    }
    const path = `${bookingId}/${paymentId}-${sanitizeReceiptName(receipt.name, mime)}`;

    const { error: uploadError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, receipt, { contentType: mime, upsert: false });
    if (uploadError) {
      console.error("[payments] upload ricevuta fallito:", uploadError);
      await supabase.from("payments").delete().eq("id", paymentId);
      return fail("Impossibile caricare la ricevuta. L'acconto non è stato salvato: riprova.");
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        receipt_path: path,
        receipt_name: receipt.name.slice(0, 200) || "ricevuta",
        receipt_type: mime,
      })
      .eq("id", paymentId);
    if (updateError) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
      await supabase.from("payments").delete().eq("id", paymentId);
      return dbFail(updateError);
    }
  }

  revalidatePath(`/prenotazioni/${bookingId}`);
  return { ok: true, data: { id: paymentId } };
}

/** Elimina un acconto e la sua ricevuta (solo admin). */
export async function deletePayment(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Acconto non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const { supabase } = auth;
  const { data: row, error: readError } = await supabase
    .from("payments")
    .select("id, booking_id, receipt_path")
    .eq("id", id)
    .maybeSingle();
  if (readError) return dbFail(readError);
  if (!row) return fail("Acconto non trovato.");

  // Prima la riga: se la cancellazione fallisce il file resta e l'acconto è ancora consistente.
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return dbFail(error);

  if (row.receipt_path) {
    const { error: removeError } = await supabase.storage.from(RECEIPTS_BUCKET).remove([row.receipt_path]);
    if (removeError) console.error("[payments] rimozione ricevuta fallita:", removeError);
  }

  revalidatePath(`/prenotazioni/${row.booking_id}`);
  return { ok: true, data: undefined };
}

/** URL firmato (120 s) per aprire la ricevuta di un acconto (solo admin). */
export async function getReceiptUrl(paymentId: string): Promise<ActionResult<{ url: string }>> {
  if (!isUuid(paymentId)) return fail("Acconto non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const { supabase } = auth;
  const { data: row, error: readError } = await supabase
    .from("payments")
    .select("receipt_path")
    .eq("id", paymentId)
    .maybeSingle();
  if (readError) return dbFail(readError);
  if (!row?.receipt_path) return fail("Nessuna ricevuta allegata a questo acconto.");

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(row.receipt_path, SIGNED_URL_SECONDS);
  if (error || !data) {
    console.error("[payments] URL firmato fallito:", error);
    return fail("Impossibile aprire la ricevuta. Riprova.");
  }
  return { ok: true, data: { url: data.signedUrl } };
}
