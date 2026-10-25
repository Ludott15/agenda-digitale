export type Role = "admin" | "sala" | "cucina";
export type Course = "antipasto" | "primo" | "secondo" | "contorno" | "dolce" | "bevande";
export type BookingStatus = "opzione" | "confermato" | "saldato" | "annullato";

export interface Profile { id: string; full_name: string; email: string; role: Role; is_chef: boolean; active: boolean; created_at: string; }
export interface Client { id: string; first_name: string; last_name: string; phone: string; email: string | null; tax_code: string | null; vat_number: string | null; notes: string | null; created_at: string; updated_at: string; }
export interface ClientWithStats extends Client { bookings_count: number; next_event_date: string | null; }
export interface Room { id: string; name: string; capacity: number; sort: number; active: boolean; }
export interface MenuItem { id: string; menu_id: string; course: Course; name: string; sort: number; }
export interface Menu { id: string; name: string; season: string | null; price_per_person: number; is_kids: boolean; active: boolean; sort: number; items: MenuItem[]; }
export interface BookingDish { id: string; booking_id: string; course: Course; name: string; sort: number; }
export interface BookingAllergy { id: string; booking_id: string; subject_name: string | null; condition: string; notes: string | null; }
export interface Booking {
  id: string; client_id: string; event_name: string | null; event_date: string; event_time: string | null;
  room_id: string | null; adults: number; children: number; kids_menus: number;
  menu_id: string | null; kids_menu_id: string | null; setup_colors: string[]; setup_notes: string | null;
  status: BookingStatus; notes: string | null; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
}
export interface BookingListItem extends Booking {
  client: Pick<Client, "id" | "first_name" | "last_name" | "phone">;
  room: Pick<Room, "id" | "name" | "capacity"> | null;
  menu: Pick<Menu, "id" | "name" | "price_per_person"> | null;
  dishes: BookingDish[];            // per mostrare il menù a colpo d'occhio
  allergies: BookingAllergy[];
}
export type ClientOption = Pick<Client, "id" | "first_name" | "last_name" | "phone">;
/** Slot di occupazione sala per la vista agenda (select minima, senza annullati). */
export interface RoomBookingSlot { id: string; event_date: string; event_name: string | null; room_id: string; client_name: string; adults: number; children: number; }
export interface BookingDetail extends Booking {
  client: Client; room: Room | null; menu: Menu | null; kids_menu: Menu | null;
  dishes: BookingDish[]; allergies: BookingAllergy[];
}
export interface BookingChange { id: number; booking_id: string | null; booking_label: string | null; changed_by: string | null; changed_by_name: string; table_name: string; field: string; old_value: string | null; new_value: string | null; created_at: string; }
export interface QuoteLine { description: string; quantity: number; unit_price: number; }
export interface Quote { id: string; booking_id: string; number: string; issued_at: string; valid_until: string | null; lines: QuoteLine[]; discount: number; vat_rate: number; notes: string | null; created_at: string; }
export interface QuoteWithBooking extends Quote { booking: BookingDetail; }
export interface QuoteTotals { subtotal: number; discount: number; total: number; taxable: number; vat: number; } // prezzi IVA inclusa: taxable = total/(1+vat/100)
export interface DashboardStats { eventsThisMonth: number; coversNext7Days: number; pendingOptions: number; eventsToday: number; }

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const SETUP_COLORS = ["Bianco","Avorio","Champagne","Oro","Argento","Rosa cipria","Pesca","Verde salvia","Verde oliva","Azzurro","Blu notte","Bordeaux","Lilla","Rosso","Nero"] as const;
export const SETUP_COLOR_HEX: Record<(typeof SETUP_COLORS)[number], string> = {
  "Bianco": "#FFFFFF",
  "Avorio": "#FFFFF0",
  "Champagne": "#F7E7CE",
  "Oro": "#C9A227",
  "Argento": "#C0C0C0",
  "Rosa cipria": "#E8C4C4",
  "Pesca": "#FFCBA4",
  "Verde salvia": "#9CAF88",
  "Verde oliva": "#6B6E3A",
  "Azzurro": "#9EC9E2",
  "Blu notte": "#191E3C",
  "Bordeaux": "#6D1F2A",
  "Lilla": "#C8A2C8",
  "Rosso": "#B22222",
  "Nero": "#111111",
};
export const COURSE_ORDER: Course[] = ["antipasto","primo","secondo","contorno","dolce","bevande"];
export const COURSE_LABELS: Record<Course, string> = { antipasto: "Antipasto", primo: "Primo", secondo: "Secondo", contorno: "Contorno", dolce: "Dolce", bevande: "Bevande" };
export const ROLE_LABELS: Record<Role, string> = { admin: "Amministratore", sala: "Sala", cucina: "Cucina" };
export const STATUS_LABELS: Record<BookingStatus, string> = { opzione: "Attesa", confermato: "Confermato", saldato: "Saldato", annullato: "Annullato" };
export const STATUS_COLORS: Record<BookingStatus, string> = { opzione: "#A9792B", confermato: "#355A63", saldato: "#4F6B45", annullato: "#9B3B32" };

export const PAYMENT_METHODS = ["contanti", "bonifico", "carta", "assegno", "altro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { contanti: "Contanti", bonifico: "Bonifico", carta: "Carta", assegno: "Assegno", altro: "Altro" };
export interface Payment { id: string; booking_id: string; amount: number; paid_at: string; method: PaymentMethod | null; receipt_path: string | null; receipt_name: string | null; receipt_type: string | null; notes: string | null; created_at: string; }
export interface PaymentSummary { expected_total: number; paid_total: number; balance: number; } // expected = adults*menu.price + kids_menus*kids_menu.price

export type NotificationType = "booking_created" | "booking_updated" | "booking_status" | "booking_cancelled" | "booking_deleted" | "covers_updated" | "dishes_updated" | "event_reminder";
export interface AppNotification { id: string; type: NotificationType; title: string; body: string | null; booking_id: string | null; actor_name: string | null; read_at: string | null; created_at: string; }
