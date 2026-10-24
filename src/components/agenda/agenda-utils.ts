import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isValid,
  parseISO,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";
import type { BookingListItem } from "@/lib/types";

export type AgendaView = "month" | "week" | "day";

export const AGENDA_TZ = "Europe/Rome";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Data odierna nel fuso del Casale (YYYY-MM-DD). */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENDA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Valida il parametro `date` della query; fallback a oggi. */
export function parseDateParam(value: string | undefined): string {
  if (value && ISO_DATE_RE.test(value) && isValid(parseISO(value))) return value;
  return todayISO();
}

export function parseView(value: string | undefined): AgendaView {
  return value === "week" || value === "day" ? value : "month";
}

export function toDate(iso: string): Date {
  return parseISO(iso);
}

export function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatIt(date: Date, pattern: string): string {
  return format(date, pattern, { locale: it });
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Link alla vista agenda con searchParams. */
export function agendaHref({ date, view = "month" }: { date: string; view?: AgendaView }): string {
  const params = new URLSearchParams({ date, view });
  return `/agenda?${params.toString()}`;
}

/** Sposta il periodo selezionato di una unità della vista corrente. */
export function shiftPeriod(iso: string, view: AgendaView, direction: 1 | -1): string {
  const date = toDate(iso);
  if (view === "month") return toISO(direction > 0 ? addMonths(date, 1) : subMonths(date, 1));
  if (view === "week") return toISO(direction > 0 ? addWeeks(date, 1) : subWeeks(date, 1));
  return toISO(direction > 0 ? addDays(date, 1) : subDays(date, 1));
}

/** I 7 giorni (lun-dom) della settimana che contiene `iso`. */
export function weekDates(iso: string): Date[] {
  const start = startOfWeek(toDate(iso), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function groupByDate(bookings: BookingListItem[]): Map<string, BookingListItem[]> {
  const map = new Map<string, BookingListItem[]>();
  for (const booking of bookings) {
    const bucket = map.get(booking.event_date);
    if (bucket) bucket.push(booking);
    else map.set(booking.event_date, [booking]);
  }
  return map;
}
