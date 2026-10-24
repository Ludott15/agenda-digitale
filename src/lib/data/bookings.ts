import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/action-utils";
import { addDaysISO, monthBounds, romeToday } from "@/lib/dates";
import type {
  BookingChange,
  BookingDetail,
  BookingListItem,
  DashboardStats,
  RoomBookingSlot,
} from "@/lib/types";
import {
  BOOKING_DETAIL_SELECT,
  BOOKING_LIST_SELECT,
  assertOk,
  normalizeBookingDetail,
  normalizeBookingListItem,
  num,
} from "./shared";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Prenotazioni con sala assegnata nell'intervallo (esclusi gli annullati), select minima. */
export async function getRoomBookingSlots(from: string, to: string): Promise<RoomBookingSlot[]> {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, event_date, event_name, room_id, adults, children, client:clients(first_name, last_name)")
    .gte("event_date", from)
    .lte("event_date", to)
    .neq("status", "annullato")
    .not("room_id", "is", null)
    .order("event_date", { ascending: true });
  assertOk(error);

  const rows = (data ?? []) as unknown as {
    id: string;
    event_date: string;
    event_name: string | null;
    room_id: string;
    adults: unknown;
    children: unknown;
    client: { first_name: string; last_name: string } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    event_date: r.event_date,
    event_name: r.event_name,
    room_id: r.room_id,
    client_name: r.client ? `${r.client.first_name} ${r.client.last_name}` : "",
    adults: num(r.adults),
    children: num(r.children),
  }));
}

export async function getBookingsInRange(
  from: string,
  to: string,
  opts?: { includeCancelled?: boolean },
): Promise<BookingListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(BOOKING_LIST_SELECT)
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false });
  if (!opts?.includeCancelled) query = query.neq("status", "annullato");

  const { data, error } = await query;
  assertOk(error);
  return (data ?? []).map(normalizeBookingListItem);
}

export async function getBooking(id: string): Promise<BookingDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  assertOk(error);
  return data ? normalizeBookingDetail(data) : null;
}

export async function getBookingChanges(bookingId: string): Promise<BookingChange[]> {
  if (!isUuid(bookingId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_changes")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  assertOk(error);
  return (data ?? []) as BookingChange[];
}

/** Registro delle eliminazioni di prenotazioni (più recenti per primo), per la dashboard admin. */
export async function getDeletionLog(limit: number): Promise<BookingChange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_changes")
    .select("*")
    .eq("field", "eliminazione")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  assertOk(error);
  return (data ?? []) as BookingChange[];
}

export async function getRoomOccupancy(date: string): Promise<{ room_id: string; booking_id: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, room_id")
    .eq("event_date", date)
    .neq("status", "annullato")
    .not("room_id", "is", null);
  assertOk(error);
  return (data ?? []).map((r: { id: string; room_id: string }) => ({
    room_id: r.room_id,
    booking_id: r.id,
  }));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const today = romeToday();
  const { from, to } = monthBounds(today);
  const weekEnd = addDaysISO(today, 6);

  const countQuery = () =>
    supabase.from("bookings").select("id", { count: "exact", head: true }).neq("status", "annullato");

  const [monthRes, todayRes, pendingRes, weekRes] = await Promise.all([
    countQuery().gte("event_date", from).lte("event_date", to),
    countQuery().eq("event_date", today),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "opzione")
      .gte("event_date", today),
    supabase
      .from("bookings")
      .select("adults, children")
      .neq("status", "annullato")
      .gte("event_date", today)
      .lte("event_date", weekEnd),
  ]);

  assertOk(monthRes.error);
  assertOk(todayRes.error);
  assertOk(pendingRes.error);
  assertOk(weekRes.error);

  const coversNext7Days = (weekRes.data ?? []).reduce(
    (acc: number, b: { adults: unknown; children: unknown }) => acc + num(b.adults) + num(b.children),
    0,
  );

  return {
    eventsThisMonth: monthRes.count ?? 0,
    eventsToday: todayRes.count ?? 0,
    pendingOptions: pendingRes.count ?? 0,
    coversNext7Days,
  };
}

export async function getUpcomingBookings(limit: number): Promise<BookingListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_LIST_SELECT)
    .gte("event_date", romeToday())
    .neq("status", "annullato")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  assertOk(error);
  return (data ?? []).map(normalizeBookingListItem);
}
