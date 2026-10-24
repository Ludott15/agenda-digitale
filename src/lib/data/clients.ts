import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/action-utils";
import { romeToday } from "@/lib/dates";
import type { Client, ClientOption, ClientWithStats, BookingListItem } from "@/lib/types";
import { BOOKING_LIST_SELECT, assertOk, normalizeBookingListItem } from "./shared";

/** Rimuove i caratteri con significato nei filtri PostgREST / LIKE. */
function sanitizeSearch(term: string | undefined): string {
  return (term ?? "").replace(/[%_,()*"\\]/g, " ").trim().slice(0, 100);
}

export async function getClients(search?: string): Promise<ClientWithStats[]> {
  const supabase = await createClient();
  let query = supabase.from("clients").select("*").order("last_name").order("first_name");

  const term = sanitizeSearch(search);
  if (term) {
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  assertOk(error);
  const clients = (data ?? []) as Client[];
  if (clients.length === 0) return [];

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("client_id, event_date")
    .in("client_id", clients.map((c) => c.id))
    .neq("status", "annullato");
  assertOk(bookingsError);

  const today = romeToday();
  const stats = new Map<string, { count: number; next: string | null }>();
  for (const b of (bookings ?? []) as { client_id: string; event_date: string }[]) {
    const s = stats.get(b.client_id) ?? { count: 0, next: null };
    s.count += 1;
    if (b.event_date >= today && (s.next === null || b.event_date < s.next)) {
      s.next = b.event_date;
    }
    stats.set(b.client_id, s);
  }

  return clients.map((c) => ({
    ...c,
    bookings_count: stats.get(c.id)?.count ?? 0,
    next_event_date: stats.get(c.id)?.next ?? null,
  }));
}

/** Elenco minimo per i selettori (es. nuova prenotazione), ordinato per cognome e nome. */
export async function getClientOptions(): Promise<ClientOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone")
    .order("last_name")
    .order("first_name");
  assertOk(error);
  return (data ?? []) as ClientOption[];
}

export async function getClient(id: string): Promise<Client | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  assertOk(error);
  return (data as Client | null) ?? null;
}

export async function getClientBookings(clientId: string): Promise<BookingListItem[]> {
  if (!isUuid(clientId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_LIST_SELECT)
    .eq("client_id", clientId)
    .order("event_date", { ascending: false })
    .order("event_time", { ascending: true, nullsFirst: false });
  assertOk(error);
  return (data ?? []).map(normalizeBookingListItem);
}
