"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { BookingInput, CoversInput, DishesInput } from "@/lib/validation";
import { authorize, dbFail, fail, invalidInput, isUuid } from "@/lib/action-utils";
import { canEditCovers, canEditDishes, isAdmin } from "@/lib/permissions";
import { loadBookingBrief, notifyBookingDeleted, notifyBookingEvent } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";

function revalidateBooking(id?: string, clientId?: string): void {
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/prenotazioni/nuova");
  if (id) revalidatePath(`/prenotazioni/${id}`);
  if (clientId) revalidatePath(`/clienti/${clientId}`);
}

/** Crea una prenotazione (admin). Allergie e piatti sono salvati in un'unica transazione (RPC upsert_booking). */
export async function createBooking(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = BookingInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { data, error } = await auth.supabase.rpc("upsert_booking", {
    p_id: null,
    p_data: parsed.data,
  });
  if (error || typeof data !== "string") return dbFail(error);

  revalidateBooking(data, parsed.data.client_id);
  const actor = auth.profile;
  after(() => notifyBookingEvent({ type: "booking_created", bookingId: data, actor }));
  return { ok: true, data: { id: data } };
}

/** Modifica una prenotazione (admin). Se `dishes` è presente sostituisce i piatti, altrimenti li ricopia dal menù solo se il menù cambia. */
export async function updateBooking(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Prenotazione non valida.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = BookingInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  // Stato precedente, per scegliere il tipo di notifica (cambio stato / annullamento / modifica generica).
  const { data: previous } = await auth.supabase
    .from("bookings")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await auth.supabase.rpc("upsert_booking", {
    p_id: id,
    p_data: parsed.data,
  });
  if (error) return dbFail(error);

  revalidateBooking(id, parsed.data.client_id);
  const newStatus = parsed.data.status;
  const type =
    newStatus === "annullato" && previous?.status !== "annullato"
      ? "booking_cancelled"
      : previous?.status && previous.status !== newStatus
        ? "booking_status"
        : "booking_updated";
  const actor = auth.profile;
  after(() => notifyBookingEvent({ type, bookingId: id, actor }));
  return { ok: true, data: undefined };
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Prenotazione non valida.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  // Dati per la notifica: vanno letti prima della cancellazione.
  const brief = await loadBookingBrief(id);

  const { error } = await auth.supabase.from("bookings").delete().eq("id", id);
  // 23503: esistono preventivi o acconti collegati (FK restrict).
  if (error?.code === "23503") {
    return fail("Impossibile eliminare la prenotazione: esistono preventivi o acconti collegati. Elimina prima quelli collegati o imposta lo stato Annullato.");
  }
  if (error) return dbFail(error);

  revalidateBooking();
  const actor = auth.profile;
  if (brief) after(() => notifyBookingDeleted(brief, actor));
  return { ok: true, data: undefined };
}

/** Coperti: admin o sala (RPC update_booking_covers, con audit). */
export async function updateBookingCovers(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Prenotazione non valida.");
  const auth = await authorize(canEditCovers, "Non sei autorizzato a modificare i coperti.");
  if (!auth.ok) return auth;

  const parsed = CoversInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await auth.supabase.rpc("update_booking_covers", {
    p_booking_id: id,
    p_adults: parsed.data.adults,
    p_children: parsed.data.children,
    p_kids_menus: parsed.data.kids_menus,
  });
  if (error) return dbFail(error);

  revalidateBooking(id);
  const actor = auth.profile;
  after(() => notifyBookingEvent({ type: "covers_updated", bookingId: id, actor }));
  return { ok: true, data: undefined };
}

/** Piatti: admin o cucina con is_chef (RPC save_booking_dishes, con audit). */
export async function updateBookingDishes(id: string, dishes: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Prenotazione non valida.");
  const auth = await authorize(canEditDishes, "Non sei autorizzato a modificare i piatti.");
  if (!auth.ok) return auth;

  const parsed = DishesInput.safeParse(dishes);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await auth.supabase.rpc("save_booking_dishes", {
    p_booking_id: id,
    p_dishes: parsed.data.map((d, index) => ({ ...d, sort: index })),
  });
  if (error) return dbFail(error);

  revalidateBooking(id);
  const actor = auth.profile;
  after(() => notifyBookingEvent({ type: "dishes_updated", bookingId: id, actor }));
  return { ok: true, data: undefined };
}

/** Ripristina i piatti copiandoli dal menù della prenotazione (admin o chef). */
export async function resetDishesFromMenu(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Prenotazione non valida.");
  const auth = await authorize(canEditDishes, "Non sei autorizzato a modificare i piatti.");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.rpc("reset_booking_dishes", { p_booking_id: id });
  if (error) return dbFail(error);

  revalidateBooking(id);
  const actor = auth.profile;
  after(() => notifyBookingEvent({ type: "dishes_updated", bookingId: id, actor }));
  return { ok: true, data: undefined };
}
