import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { isUuid } from "@/lib/action-utils";
import type { Payment } from "@/lib/types";
import { assertOk, num } from "./shared";

/** Acconti di una prenotazione (solo admin: per gli altri ritorna array vuoto). */
export async function getPayments(bookingId: string): Promise<Payment[]> {
  if (!isUuid(bookingId)) return [];
  const me = await getCurrentProfile();
  if (!me || !isAdmin(me)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, booking_id, amount, paid_at, method, receipt_path, receipt_name, receipt_type, notes, created_at")
    .eq("booking_id", bookingId)
    .order("paid_at", { ascending: true })
    .order("created_at", { ascending: true });
  assertOk(error);

  return (data ?? []).map((row) => ({
    ...row,
    amount: num(row.amount),
  })) as Payment[];
}
