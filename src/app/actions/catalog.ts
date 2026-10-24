"use server";

import { revalidatePath } from "next/cache";
import { MenuInput, RoomInput } from "@/lib/validation";
import { authorize, dbFail, fail, invalidInput, isUuid } from "@/lib/action-utils";
import { isAdmin } from "@/lib/permissions";
import type { ActionResult } from "@/lib/types";

function revalidateCatalog(): void {
  revalidatePath("/catalogo");
  revalidatePath("/agenda");
  revalidatePath("/prenotazioni/nuova");
}

/** Crea o aggiorna un menù con le sue voci (RPC upsert_menu, atomica). */
export async function upsertMenu(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = MenuInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id, ...menu } = parsed.data;

  const { data, error } = await auth.supabase.rpc("upsert_menu", {
    p_id: id ?? null,
    p_data: menu,
  });
  if (error || typeof data !== "string") return dbFail(error);

  revalidateCatalog();
  return { ok: true, data: { id: data } };
}

/** Disattiva il menù (active = false). Nessuna eliminazione fisica: lo storico delle prenotazioni resta integro. */
export async function deleteMenu(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("Menù non valido.");
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("menus").update({ active: false }).eq("id", id);
  if (error) return dbFail(error);

  revalidateCatalog();
  return { ok: true, data: undefined };
}

export async function upsertRoom(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize(isAdmin);
  if (!auth.ok) return auth;

  const parsed = RoomInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { id, ...room } = parsed.data;

  if (id) {
    const { error } = await auth.supabase.from("rooms").update(room).eq("id", id);
    if (error) return error.code === "23505"
      ? fail("Esiste già una sala con questo nome.")
      : dbFail(error);
    revalidateCatalog();
    return { ok: true, data: { id } };
  }

  const { data, error } = await auth.supabase.from("rooms").insert(room).select("id").single();
  if (error || !data) {
    return error?.code === "23505"
      ? fail("Esiste già una sala con questo nome.")
      : dbFail(error);
  }

  revalidateCatalog();
  return { ok: true, data: { id: data.id as string } };
}
