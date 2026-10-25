#!/usr/bin/env node
// Passa il ruolo di amministratore a un altro account (l'app supporta un solo admin).
// Uso: node scripts/transfer-admin.mjs <nuova-email> "<Nome Cognome>"
// La password del nuovo admin viene chiesta a terminale senza mostrarla
// (non finisce nella cronologia della shell). Se l'account esiste già, la password resta invariata.
// Il vecchio admin diventa un operatore di sala DISATTIVATO (riattivabile da "Operatori").
// In caso di errore il vecchio admin viene ripristinato.

import { createClient } from "@supabase/supabase-js";
import { ensureAdmin, MIN_PASSWORD_LENGTH } from "./lib/admin.mjs";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Nessun .env.local: si usano le variabili d'ambiente di sistema.
}

const [rawEmail, fullName] = process.argv.slice(2);
if (!rawEmail || !fullName) {
  console.error('Uso: node scripts/transfer-admin.mjs <nuova-email> "<Nome Cognome>"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (controlla .env.local).");
  process.exit(1);
}

/** Legge una riga dal terminale senza mostrarla. */
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error("Serve un terminale interattivo per inserire la password."));
      return;
    }
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.stdout.write("\n");
        process.exit(1);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const email = rawEmail.trim().toLowerCase();
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: currentAdmins, error: readError } = await supabase
  .from("profiles")
  .select("id, email, full_name, role, is_chef, active")
  .eq("role", "admin");
if (readError) {
  console.error(`Errore lettura amministratore attuale: ${readError.message}`);
  process.exit(1);
}
const previous = (currentAdmins ?? []).filter((p) => p.email?.toLowerCase() !== email);

const password = await askHidden(`Password per ${email} (min ${MIN_PASSWORD_LENGTH} caratteri): `);
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
  process.exit(1);
}
const confirm = await askHidden("Ripeti la password: ");
if (confirm !== password) {
  console.error("Le password non coincidono.");
  process.exit(1);
}

// 1. Il vecchio admin diventa operatore di sala disattivato (libera il posto di admin).
for (const p of previous) {
  const { error } = await supabase
    .from("profiles")
    .update({ role: "sala", is_chef: false, active: false })
    .eq("id", p.id);
  if (error) {
    console.error(`Errore nel declassare ${p.email}: ${error.message}`);
    process.exit(1);
  }
}

// 2. Nuovo admin; in caso di errore si ripristina il precedente.
try {
  const result = await ensureAdmin({ url, serviceKey, email, password, fullName });
  if (result.existed) console.log("Account già esistente: password invariata.");
  console.log(`Amministratore ora: ${fullName} <${result.email}>`);
  for (const p of previous) {
    console.log(`Account precedente ${p.email}: operatore di sala disattivato (riattivabile da "Operatori").`);
  }
} catch (err) {
  for (const p of previous) {
    await supabase
      .from("profiles")
      .update({ role: p.role, is_chef: p.is_chef, active: p.active })
      .eq("id", p.id);
  }
  console.error(`Passaggio annullato, amministratore precedente ripristinato. Motivo: ${err.message}`);
  process.exit(1);
}
