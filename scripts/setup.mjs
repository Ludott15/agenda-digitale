#!/usr/bin/env node
// Setup automatico dell'Agenda Digitale: legge .env.local, applica le migrazioni SQL,
// crea l'amministratore e (se possibile) disattiva le registrazioni pubbliche.
// Uso: npm run setup
// Tutti i passaggi sono idempotenti: si può rilanciare senza effetti collaterali.

import { access, copyFile, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ensureAdmin, MIN_PASSWORD_LENGTH } from "./lib/admin.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const TRACKING_TABLE = "public._app_migrations";
const BASELINE_MIGRATION_PREFIX = "0001_";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
];

const WHERE_TO_FIND = {
  NEXT_PUBLIC_SUPABASE_URL: 'dashboard Supabase → Project Settings → API → "Project URL"',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dashboard Supabase → Project Settings → API → "anon public" key',
  SUPABASE_SERVICE_ROLE_KEY: 'dashboard Supabase → Project Settings → API → "service_role" key (solo server)',
  SUPABASE_DB_URL:
    'dashboard Supabase → Connect (in alto) → Connection string → "Session pooler" URI, ' +
    "con la password del database al posto di [YOUR-PASSWORD]",
  ADMIN_EMAIL: "email dell'amministratore da creare",
  ADMIN_PASSWORD: `password dell'amministratore, almeno ${MIN_PASSWORD_LENGTH} caratteri`,
};

// Valori copiati dagli esempi o non sostituiti: non sono credenziali reali.
const PLACEHOLDER_RE = /example\.supabase\.co|dummy|\[YOUR-PASSWORD\]|\[PROJECT-REF\]/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ok = (msg) => console.log(`  ✔ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    dbUrl: process.env.SUPABASE_DB_URL?.trim() ?? "",
    adminEmail: process.env.ADMIN_EMAIL?.trim() ?? "",
    adminPassword: process.env.ADMIN_PASSWORD ?? "",
    adminName: process.env.ADMIN_NAME?.trim() || "Peppe Moschetto",
    accessToken: process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? "",
  };
}

function validate(env) {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    const lines = missing.map((k) => `  - ${k}: ${WHERE_TO_FIND[k]}`).join("\n");
    fail(`Mancano queste variabili in .env.local:\n${lines}\nCompilale e rilancia: npm run setup`);
  }

  const SECRET_KEYS = REQUIRED.filter((k) => k !== "ADMIN_EMAIL" && k !== "ADMIN_PASSWORD");
  const placeholders = SECRET_KEYS.filter((k) => PLACEHOLDER_RE.test(process.env[k]));
  if (placeholders.length) {
    const lines = placeholders.map((k) => `  - ${k}: ${WHERE_TO_FIND[k]}`).join("\n");
    fail(`Questi valori sono segnaposto e non credenziali reali in .env.local:\n${lines}`);
  }

  const problems = [];
  try {
    const u = new URL(env.url);
    if (u.protocol !== "https:") problems.push("NEXT_PUBLIC_SUPABASE_URL deve iniziare con https://");
  } catch {
    problems.push("NEXT_PUBLIC_SUPABASE_URL non è un URL valido (es. https://abcdefghijkl.supabase.co)");
  }
  try {
    const u = new URL(env.dbUrl);
    if (!["postgres:", "postgresql:"].includes(u.protocol)) {
      problems.push("SUPABASE_DB_URL deve iniziare con postgresql://");
    }
  } catch {
    problems.push("SUPABASE_DB_URL non è una connection string valida (usa l'URI copiato dalla dashboard)");
  }
  if (!EMAIL_RE.test(env.adminEmail)) problems.push("ADMIN_EMAIL non sembra un'email valida");
  if (env.adminPassword.length < MIN_PASSWORD_LENGTH) {
    problems.push(`ADMIN_PASSWORD deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`);
  }
  if (problems.length) {
    fail(`Valori non validi in .env.local:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
}

async function connectDb(dbUrl) {
  // sslmode nella URL sovrascriverebbe la nostra opzione ssl: lo rimuoviamo.
  const u = new URL(dbUrl);
  u.searchParams.delete("sslmode");
  // Supabase richiede SSL; un Postgres locale di test (localhost) di norma no.
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  const client = new pg.Client({
    connectionString: u.toString(),
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  try {
    await client.connect();
  } catch (err) {
    fail(
      `Impossibile connettersi al database: ${err.message}\n` +
        "  Controlla SUPABASE_DB_URL: deve essere la Session pooler URI con la password del database."
    );
  }
  return client;
}

async function runMigrations(client) {
  const { rows: [state] } = await client.query(
    `select to_regclass('${TRACKING_TABLE}') is not null as tracking_present,
            to_regclass('public.profiles') is not null as profiles_present`
  );

  if (!state.tracking_present) {
    await client.query(`
      create table if not exists ${TRACKING_TABLE} (
        name       text primary key,
        applied_at timestamptz not null default now()
      )`);
    // Tabella interna: niente accesso via API pubblica (il service role/owner la bypassa).
    await client.query(`alter table ${TRACKING_TABLE} enable row level security`);
    await client.query(`revoke all on ${TRACKING_TABLE} from anon, authenticated`);
    if (state.profiles_present) {
      // Database già inizializzato prima del tracking: la migrazione base non va rieseguita.
      const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql"));
      for (const f of files.filter((f) => f.startsWith(BASELINE_MIGRATION_PREFIX))) {
        await client.query(`insert into ${TRACKING_TABLE} (name) values ($1) on conflict do nothing`, [f]);
      }
      ok("Schema già presente: migrazione base registrata come applicata");
    }
  }

  const { rows } = await client.query(`select name from ${TRACKING_TABLE}`);
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`insert into ${TRACKING_TABLE} (name) values ($1)`, [file]);
      await client.query("COMMIT");
      count++;
      ok(`Migrazione applicata: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      let where = "";
      if (err.position) {
        const line = sql.slice(0, Number(err.position) - 1).split("\n").length;
        where = ` (riga ${line} del file)`;
      }
      fail(`Migrazione ${file} fallita, modifiche annullate: ${err.message}${where}`);
    }
  }
  if (count === 0) ok("Database già aggiornato: nessuna migrazione da applicare");
  return count;
}

async function disableSignups(url, accessToken) {
  const host = new URL(url).hostname;
  const ref = host.endsWith(".supabase.co") ? host.split(".")[0] : null;
  if (!ref) {
    warn("Progetto non riconosciuto come *.supabase.co: registrazioni pubbliche non disattivate automaticamente.");
    return false;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ disable_signup: true }),
  });
  if (!res.ok) {
    throw new Error(`Management API ha risposto HTTP ${res.status}`);
  }
  return true;
}

async function main() {
  console.log("Agenda Digitale - setup\n");

  if (!(await exists(ENV_FILE))) {
    await copyFile(ENV_EXAMPLE, ENV_FILE);
    console.log("Ho creato .env.local partendo da .env.example.");
    fail("Compila .env.local e rilancia: npm run setup");
  }

  process.loadEnvFile(ENV_FILE);
  const env = readEnv();
  validate(env);

  console.log("Migrazioni database");
  const client = await connectDb(env.dbUrl);
  try {
    await runMigrations(client);
  } finally {
    await client.end();
  }

  console.log("\nAmministratore");
  const admin = await ensureAdmin({
    url: env.url,
    serviceKey: env.serviceKey,
    email: env.adminEmail,
    password: env.adminPassword,
    fullName: env.adminName,
  });
  ok(
    admin.existed
      ? `Utente già esistente promosso ad amministratore: ${admin.email} (password invariata)`
      : `Amministratore creato: ${admin.email}`
  );

  console.log("\nRegistrazioni pubbliche");
  if (env.accessToken) {
    try {
      if (await disableSignups(env.url, env.accessToken)) {
        ok("Registrazioni pubbliche disattivate");
      }
    } catch (err) {
      warn(`Non sono riuscito a disattivarle automaticamente (${err.message}).`);
      warn("Disattivale a mano: dashboard Supabase → Authentication → Providers → Email → disattiva \"Allow new users to sign up\".");
    }
  } else {
    warn("Facoltativo: non disattivate (SUPABASE_ACCESS_TOKEN non impostato).");
    console.log(
      "    Chi si registra da solo non ha un profilo, quindi non accede all'app.\n" +
        "    Per disattivarle a mano: dashboard Supabase → Authentication → Providers → Email →\n" +
        '    disattiva "Allow new users to sign up".'
    );
  }

  console.log(`\n✔ Setup completato.\n\nOra lancia: npm run dev e accedi su http://localhost:3000 con ${admin.email}`);
}

main().catch((err) => fail(err.message));
