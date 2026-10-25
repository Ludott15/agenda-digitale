"use server";

import { z } from "zod";
import { authorize, dbFail, invalidInput } from "@/lib/action-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";

// Notifiche e sottoscrizioni push: tutti gli utenti attivi.

const IdsInput = z.array(z.uuid({ message: "Identificativo non valido" })).max(500).optional();

// Solo i servizi push dei browser: il server non deve mai inviare richieste a host scelti dall'utente.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
];

function isPushServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

const PushSubscriptionInput = z.object({
  endpoint: z
    .string()
    .max(2048, "Endpoint troppo lungo")
    .refine(isPushServiceUrl, "Endpoint non valido"),
  keys: z.object({
    p256dh: z.string().min(1, "Chiave p256dh mancante").max(256),
    auth: z.string().min(1, "Chiave auth mancante").max(256),
  }),
});

/** Segna come lette le notifiche indicate (senza ids: tutte quelle non lette dell'utente). */
export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const parsed = IdsInput.safeParse(ids);
  if (!parsed.success) return invalidInput(parsed.error);

  const auth = await authorize(() => true);
  if (!auth.ok) return auth;

  if (parsed.data && parsed.data.length === 0) return { ok: true, data: undefined };

  let query = auth.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (parsed.data) query = query.in("id", parsed.data);

  const { error } = await query;
  if (error) return dbFail(error);
  return { ok: true, data: undefined };
}

/**
 * Registra la sottoscrizione push del dispositivo corrente per l'utente attivo.
 * Upsert su endpoint: lo stesso browser, se usato da un altro account, passa al nuovo utente.
 */
export async function savePushSubscription(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
): Promise<ActionResult> {
  const parsed = PushSubscriptionInput.safeParse(sub);
  if (!parsed.success) return invalidInput(parsed.error);

  const auth = await authorize(() => true);
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      profile_id: auth.profile.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: userAgent?.trim().slice(0, 300) || null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return dbFail(error);
  return { ok: true, data: undefined };
}

/** Rimuove la sottoscrizione push di questo dispositivo (solo le proprie, per RLS). */
export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const parsed = z.string().max(2048).safeParse(endpoint);
  if (!parsed.success) return invalidInput(parsed.error);

  const auth = await authorize(() => true);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data);
  if (error) return dbFail(error);
  return { ok: true, data: undefined };
}
