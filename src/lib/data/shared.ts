import "server-only";
import { COURSE_ORDER, type BookingAllergy, type BookingDetail, type BookingDish, type BookingListItem, type Course, type Menu, type MenuItem, type Quote, type QuoteLine, type QuoteWithBooking } from "@/lib/types";

// Select PostgREST condivise. Le FK doppie su menus (menu_id / kids_menu_id) richiedono gli hint per nome vincolo.
export const MENU_SELECT = "*, items:menu_items(*)";

export const BOOKING_LIST_SELECT =
  "*, client:clients(id, first_name, last_name, phone), room:rooms(id, name, capacity), " +
  "menu:menus!bookings_menu_id_fkey(id, name, price_per_person), dishes:booking_dishes(*), allergies:booking_allergies(*)";

export const BOOKING_DETAIL_SELECT =
  "*, client:clients(*), room:rooms(*), " +
  `menu:menus!bookings_menu_id_fkey(${MENU_SELECT}), ` +
  `kids_menu:menus!bookings_kids_menu_id_fkey(${MENU_SELECT}), ` +
  "dishes:booking_dishes(*), allergies:booking_allergies(*)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function courseRank(c: Course): number {
  const i = COURSE_ORDER.indexOf(c);
  return i === -1 ? COURSE_ORDER.length : i;
}

export function sortDishes(dishes: BookingDish[]): BookingDish[] {
  return [...dishes].sort((a, b) => courseRank(a.course) - courseRank(b.course) || a.sort - b.sort);
}

export function sortItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => courseRank(a.course) - courseRank(b.course) || a.sort - b.sort);
}

export function normalizeMenu(row: Row): Menu {
  return {
    ...row,
    price_per_person: num(row.price_per_person),
    items: sortItems((row.items ?? []) as MenuItem[]),
  } as Menu;
}

export function normalizeBookingListItem(row: Row): BookingListItem {
  return {
    ...row,
    adults: num(row.adults),
    children: num(row.children),
    kids_menus: num(row.kids_menus),
    setup_colors: row.setup_colors ?? [],
    client: row.client,
    room: row.room ?? null,
    menu: row.menu ? { ...row.menu, price_per_person: num(row.menu.price_per_person) } : null,
    dishes: sortDishes((row.dishes ?? []) as BookingDish[]),
    allergies: (row.allergies ?? []) as BookingAllergy[],
  } as BookingListItem;
}

export function normalizeBookingDetail(row: Row): BookingDetail {
  return {
    ...row,
    adults: num(row.adults),
    children: num(row.children),
    kids_menus: num(row.kids_menus),
    setup_colors: row.setup_colors ?? [],
    room: row.room ?? null,
    menu: row.menu ? normalizeMenu(row.menu) : null,
    kids_menu: row.kids_menu ? normalizeMenu(row.kids_menu) : null,
    dishes: sortDishes((row.dishes ?? []) as BookingDish[]),
    allergies: (row.allergies ?? []) as BookingAllergy[],
  } as BookingDetail;
}

export function normalizeQuote(row: Row): Quote {
  return {
    ...row,
    discount: num(row.discount),
    vat_rate: num(row.vat_rate),
    lines: ((row.lines ?? []) as Row[]).map(
      (l): QuoteLine => ({
        description: String(l.description ?? ""),
        quantity: num(l.quantity),
        unit_price: num(l.unit_price),
      }),
    ),
  } as Quote;
}

export function normalizeQuoteWithBooking(row: Row): QuoteWithBooking {
  return { ...normalizeQuote(row), booking: normalizeBookingDetail(row.booking) };
}

/** Errore di lettura: le pagine lo gestiscono con error.tsx. */
export function assertOk(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}
