"use server";

import { revalidatePath } from "next/cache";
import { BookingInput, CoversInput, DishesInput } from "@/lib/validation";
import { authorize, dbFail, fail, invalidInput, isUuid } from "@/lib/action-utils";
import { canEditCovers, canEditDishes, isAdmin } from "@/lib/permissions";
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
  return { ok: true, data: { id: data } };
}

/** Modifica una prenotazione (admin). Se `dishes` è presente sostituisce i piatti, altrimenti li ricopia dal menù solo se il menù cambia. */
export async function updateBooking(id: string, input: unknown): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Prenotazione non valida.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = BookingInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { error } = await auth.supabase.rpc("upsert_booking", {
    p_id: id,
    p_data: parsed.data,
  });
  if (error) return dbFail(error);

  revalidateBooking(id, parsed.data.client_id);
  return { ok: true, data: undefined };
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Prenotazione non valida.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("bookings").delete().eq("id", id);
  // 23503: esistono preventivi collegati (FK restrict).
  if (error?.code === "23503") {
    return fail("Impossibile eliminare la prenotazione: esistono preventivi collegati. Elimina prima i preventivi collegati o imposta lo stato Annullato.");
  }
  if (error) return dbFail(error);

  revalidateBooking();
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
  return { ok: true, data: undefined };
}
