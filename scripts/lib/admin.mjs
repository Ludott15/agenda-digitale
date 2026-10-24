// Logica condivisa per creare (o promuovere) l'amministratore dell'Agenda Digitale.
// Usata da scripts/create-admin.mjs e scripts/setup.mjs. Idempotente.

import { createClient } from "@supabase/supabase-js";

export const MIN_PASSWORD_LENGTH = 8;

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

async function findUserIdByEmail(supabase, email) {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`Errore lettura utenti: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < PAGE_SIZE) break;
  }
  throw new Error(`Utente esistente non trovato: ${email}`);
}

/**
 * Crea l'utente Auth (email confermata) oppure, se esiste già, ne lascia invariata la password.
 * Poi imposta il profilo come admin attivo.
 * @returns {Promise<{ userId: string, email: string, existed: boolean }>}
 */
export async function ensureAdmin({ url, serviceKey, email: rawEmail, password, fullName }) {
  const email = rawEmail.trim().toLowerCase();
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId;
  let existed = false;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    if (!/already|registered|exists/i.test(createError.message)) {
      throw new Error(`Errore creazione utente: ${createError.message}`);
    }
    // L'utente Auth esiste già: lo si promuove senza cambiarne la password.
    existed = true;
    userId = await findUserIdByEmail(supabase, email);
  } else {
    userId = created.user.id;
  }

  // L'app supporta un solo amministratore: se ne esiste già un altro, non si procede.
  const { data: otherAdmins, error: adminsError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "admin")
    .neq("id", userId)
    .limit(1);
  if (adminsError) throw new Error(`Errore verifica amministratore: ${adminsError.message}`);
  if (otherAdmins && otherAdmins.length > 0) {
    if (!existed) {
      // Utente Auth appena creato solo per questo tentativo: va rimosso per non lasciare account orfani.
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) {
        throw new Error(`Impossibile annullare la creazione dell'utente ${email}: ${deleteError.message}`);
      }
    }
    throw new Error(
      `Esiste già un amministratore (${otherAdmins[0].email ?? "email sconosciuta"}): l'app supporta un solo admin. Usa quell'email in ADMIN_EMAIL.`,
    );
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    role: "admin",
    is_chef: false,
    active: true,
  });
  if (profileError) {
    throw new Error(`Errore creazione profilo: ${profileError.message}`);
  }

  return { userId, email, existed };
}
