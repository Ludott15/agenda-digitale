#!/usr/bin/env node
// Crea (o promuove) l'utente amministratore dell'Agenda Digitale tramite service role.
// Uso: node scripts/create-admin.mjs <email> <password> "<Nome Cognome>"
// Legge NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY da .env.local (se presente).
// Per la configurazione completa del progetto usare: npm run setup

import { ensureAdmin, MIN_PASSWORD_LENGTH } from "./lib/admin.mjs";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // Nessun .env.local: si usano le variabili d'ambiente di sistema.
}

const [rawEmail, password, fullName] = process.argv.slice(2);

if (!rawEmail || !password || !fullName) {
  console.error('Uso: node scripts/create-admin.mjs <email> <password> "<Nome Cognome>"');
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (controlla .env.local).");
  process.exit(1);
}

try {
  const result = await ensureAdmin({ url, serviceKey, email: rawEmail, password, fullName });
  if (result.existed) {
    console.log("Utente Auth già esistente: password invariata.");
  }
  console.log(`Amministratore pronto: ${fullName} <${result.email}>`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
