import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingNotice, buildReminderNotice, type BookingBrief } from "@/lib/notify-text";
import type { BookingStatus, NotificationType } from "@/lib/types";

// Notifiche in-app (tabella notifications) + push (web-push).
// Non deve mai far fallire l'azione chiamante: tutti gli errori vengono catturati e loggati.

export interface NotifyEvent {
  type: NotificationType;
  /** null per gli eventi su prenotazioni eliminate (la riga non esisterebbe più: FK). */
  bookingId: string | null;
  title: string;
  body?: string;
  actor: { id: string; full_name: string } | null;
  /** Default "all-except-actor". "all" per i promemoria. */
  recipients?: "all-except-actor" | "all";
}

const PUSH_PAYLOAD_MAX_BYTES = 3500; // il limite del servizio push è 4 KB
const PUSH_TTL_SECONDS = 24 * 60 * 60;

let vapidReady: boolean | null = null;

/** Configura web-push una sola volta. Ritorna false se le env VAPID mancano (si salta il push). */
function configureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("[notify] VAPID non configurate: push disattivato, solo notifiche in-app.");
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  } catch (err) {
    console.error("[notify] chiavi VAPID non valide:", err);
    vapidReady = false;
  }
  return vapidReady;
}

/** Payload JSON entro il limite: se troppo lungo si accorcia il corpo. */
function buildPushPayload(payload: { title: string; body: string; url: string; tag: string }): string {
  let body = payload.body;
  let json = JSON.stringify({ ...payload, body });
  while (new TextEncoder().encode(json).length > PUSH_PAYLOAD_MAX_BYTES && body.length > 0) {
    body = body.slice(0, Math.floor(body.length * 0.8));
    json = JSON.stringify({ ...payload, body });
  }
  return json;
}

/** Crea le notifiche in-app per i destinatari e invia il push alle loro sottoscrizioni. Ritorna i destinatari. */
export async function notify(event: NotifyEvent): Promise<number> {
  try {
    const admin = createAdminClient();

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id")
      .eq("active", true);
    if (profilesError) throw profilesError;

    const actorId = event.actor?.id ?? null;
    const exceptActor = (event.recipients ?? "all-except-actor") === "all-except-actor";
    const recipientIds: string[] = (profiles ?? [])
      .map((p: { id: string }) => p.id)
      .filter((id: string) => !(exceptActor && id === actorId));
    if (recipientIds.length === 0) return 0;

    const rows = recipientIds.map((recipient_id) => ({
      recipient_id,
      type: event.type,
      title: event.title,
      body: event.body ?? null,
      booking_id: event.bookingId,
      actor_id: actorId,
      actor_name: event.actor?.full_name ?? null,
    }));
    const { error: insertError } = await admin.from("notifications").insert(rows);
    if (insertError) throw insertError;

    if (!configureVapid()) return recipientIds.length;

    const { data: subs, error: subsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("profile_id", recipientIds);
    if (subsError) throw subsError;
    if (!subs || subs.length === 0) return recipientIds.length;

    const payload = buildPushPayload({
      title: event.title,
      body: event.body ?? "",
      url: event.bookingId ? `/prenotazioni/${event.bookingId}` : "/agenda",
      tag: `${event.type}:${event.bookingId ?? "generic"}`,
    });
    const options = {
      TTL: PUSH_TTL_SECONDS,
      urgency: event.type === "event_reminder" ? ("high" as const) : ("normal" as const),
    };

    const results = await Promise.allSettled(
      subs.map((s: { id: string; endpoint: string; p256dh: string; auth: string }) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options)
          .catch(async (err: { statusCode?: number }) => {
            // 404/410: sottoscrizione scaduta o revocata dal browser → si elimina.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await admin.from("push_subscriptions").delete().eq("id", s.id);
              return;
            }
            throw err;
          }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) console.error(`[notify] push non inviati: ${failed}`);

    return recipientIds.length;
  } catch (err) {
    console.error("[notify] invio notifica fallito:", err);
    return 0;
  }
}

// ---------------------------------------------------------------------
// Dati della prenotazione per i testi
// ---------------------------------------------------------------------
const BRIEF_SELECT =
  "id, event_date, status, adults, children, kids_menus, " +
  "client:clients(first_name, last_name), room:rooms(name), " +
  "menu:menus!bookings_menu_id_fkey(name), allergies:booking_allergies(id)";

interface BriefRow {
  id: string;
  event_date: string;
  status: BookingStatus;
  adults: number;
  children: number;
  kids_menus: number;
  client: { first_name: string; last_name: string } | null;
  room: { name: string } | null;
  menu: { name: string } | null;
  allergies: { id: string }[] | null;
}

function toBrief(r: BriefRow): BookingBrief {
  return {
    id: r.id,
    event_date: r.event_date,
    status: r.status,
    client_name: r.client ? `${r.client.first_name} ${r.client.last_name}` : "",
    room_name: r.room?.name ?? null,
    menu_name: r.menu?.name ?? null,
    adults: Number(r.adults),
    children: Number(r.children),
    kids_menus: Number(r.kids_menus),
    allergy_count: r.allergies?.length ?? 0,
  };
}

/** Carica i dati minimi di una prenotazione con il client admin. Null se non esiste o in caso di errore. */
export async function loadBookingBrief(bookingId: string): Promise<BookingBrief | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("bookings")
      .select(BRIEF_SELECT)
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    return data ? toBrief(data as unknown as BriefRow) : null;
  } catch (err) {
    console.error("[notify] lettura prenotazione fallita:", err);
    return null;
  }
}

/** Notifica un evento su una prenotazione esistente (carica i dati e costruisce i testi). Non lancia. */
export async function notifyBookingEvent(input: {
  type: Exclude<NotificationType, "event_reminder" | "booking_deleted">;
  bookingId: string;
  actor: { id: string; full_name: string } | null;
}): Promise<void> {
  try {
    const brief = await loadBookingBrief(input.bookingId);
    if (!brief) return;
    const { title, body } = buildBookingNotice(input.type, brief, input.actor?.full_name ?? null);
    await notify({ type: input.type, bookingId: brief.id, title, body, actor: input.actor });
  } catch (err) {
    console.error("[notify] evento prenotazione fallito:", err);
  }
}

/** Notifica l'eliminazione con un brief caricato PRIMA della cancellazione; senza booking_id. Non lancia. */
export async function notifyBookingDeleted(
  brief: BookingBrief,
  actor: { id: string; full_name: string } | null,
): Promise<void> {
  try {
    const { title, body } = buildBookingNotice("booking_deleted", brief, actor?.full_name ?? null);
    await notify({ type: "booking_deleted", bookingId: null, title, body, actor });
  } catch (err) {
    console.error("[notify] notifica eliminazione fallita:", err);
  }
}

/** Promemoria per le prenotazioni non annullate di una data. Ritorna il numero di prenotazioni notificate. */
export async function sendEventReminders(date: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(BRIEF_SELECT)
    .eq("event_date", date)
    .neq("status", "annullato");
  if (error) throw error;

  let sent = 0;
  for (const row of (data ?? []) as unknown as BriefRow[]) {
    const brief = toBrief(row);
    const { title, body } = buildReminderNotice(brief);
    await notify({ type: "event_reminder", bookingId: brief.id, title, body, actor: null, recipients: "all" });
    sent++;
  }
  return sent;
}
