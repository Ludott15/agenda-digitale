import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/lib/types";
import { assertOk } from "./shared";

const NOTIFICATION_COLUMNS = "id, type, title, body, booking_id, actor_name, read_at, created_at";

/** Notifiche in-app dell'utente corrente, più recenti per prime (RLS: solo le proprie). */
export async function getNotifications(limit = 30): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  assertOk(error);
  return (data ?? []) as AppNotification[];
}

/** Numero di notifiche non lette dell'utente corrente. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  assertOk(error);
  return count ?? 0;
}
