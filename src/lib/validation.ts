import { z } from "zod";
import { SETUP_COLORS } from "./types";

// ---------------------------------------------------------------------
// Limiti
// ---------------------------------------------------------------------
const MAX_TEXT = 200;      // nomi, descrizioni, voci
const MAX_NOTES = 2000;    // note libere
const MAX_PHONE = 30;
const MAX_ITEMS = 60;      // array (piatti, voci, righe, allergie)

// ---------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------
/** Stringa vuota / solo spazi / assente → null; altrimenti stringa trimmata. */
const emptyToNull = (v: unknown): unknown => {
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  return v ?? null;
};

/** Codici (CF, P.IVA): senza spazi, maiuscoli; vuoto → null. */
const normalizeCode = (v: unknown): unknown => {
  if (typeof v === "string") {
    const s = v.replace(/\s+/g, "").toUpperCase();
    return s === "" ? null : s;
  }
  return v ?? null;
};

/** Arrotonda al centesimo (importi in EUR). */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Pre-elaborazione dei campi numerici (niente coercizione a 0 di "" / null / assente):
 * vuoto o assente → undefined ("Campo obbligatorio"); stringa numerica → number; altro invariato (errore "non valido").
 */
const toNumber = (v: unknown): unknown => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? v : n;
  }
  return v;
};

/** Messaggi: campo assente → "Campo obbligatorio", valore non numerico → messaggio specifico. */
const numberError = (invalid: string) => ({
  error: (iss: { input?: unknown }) => (iss.input === undefined ? "Campo obbligatorio" : invalid),
});

const optText = z.preprocess(emptyToNull, z.string().max(MAX_TEXT, "Testo troppo lungo (max 200 caratteri)").nullable());
const optLongText = z.preprocess(emptyToNull, z.string().max(MAX_NOTES, "Testo troppo lungo (max 2000 caratteri)").nullable());
const courseSchema = z.enum(["antipasto", "primo", "secondo", "contorno", "dolce", "bevande"], {
  message: "Portata non valida",
});
const uuidSchema = z.uuid({ message: "Identificativo non valido" });
const optUuid = z.preprocess(emptyToNull, z.uuid({ message: "Identificativo non valido" }).nullable());
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ora non valida (HH:MM)");

/** Data YYYY-MM-DD reale: il round-trip con Date UTC rifiuta es. 2026-02-30. */
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida (YYYY-MM-DD)")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Data non valida");

const intMin0 = z.preprocess(
  toNumber,
  z.number(numberError("Numero non valido"))
    .int("Deve essere un numero intero")
    .min(0, "Non può essere negativo"),
);

/** Importo in EUR: 2 decimali. */
const priceSchema = z.preprocess(
  toNumber,
  z.number(numberError("Prezzo non valido")).min(0, "Il prezzo non può essere negativo").transform(round2),
);

// ---------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------
export const ClientInput = z.object({
  first_name: z.string().trim().min(1, "Nome obbligatorio").max(MAX_TEXT, "Nome troppo lungo"),
  last_name: z.string().trim().min(1, "Cognome obbligatorio").max(MAX_TEXT, "Cognome troppo lungo"),
  phone: z
    .string()
    .trim()
    .min(6, "Telefono obbligatorio (minimo 6 caratteri)")
    .max(MAX_PHONE, "Telefono troppo lungo")
    .regex(/^[+0-9 ()-]+$/, "Formato telefono non valido"),
  email: z.preprocess(emptyToNull, z.email({ message: "Email non valida" }).nullable()),
  tax_code: z.preprocess(
    normalizeCode,
    z.string().regex(/^[A-Z0-9]{16}$/, "Codice fiscale non valido (16 caratteri)").nullable(),
  ),
  vat_number: z.preprocess(
    normalizeCode,
    z.string().regex(/^(IT)?\d{11}$/, "P.IVA non valida (11 cifre)").nullable(),
  ),
  notes: optLongText,
});
export type ClientInputType = z.infer<typeof ClientInput>;

// ---------------------------------------------------------------------
// Allergie e piatti
// ---------------------------------------------------------------------
export const AllergyInput = z.object({
  subject_name: z.preprocess(emptyToNull, z.string().max(MAX_TEXT, "Nome troppo lungo").nullable()),
  condition: z.string().trim().min(1, "Indicare la condizione").max(MAX_TEXT, "Condizione troppo lunga"),
  notes: optLongText,
});
export type AllergyInputType = z.infer<typeof AllergyInput>;

export const DishInput = z.object({
  course: courseSchema,
  name: z.string().trim().min(1, "Nome piatto obbligatorio").max(MAX_TEXT, "Nome piatto troppo lungo"),
  sort: intMin0,
});
export type DishInputType = z.infer<typeof DishInput>;

export const DishesInput = z.array(DishInput).max(MAX_ITEMS, "Troppi piatti (massimo 60)");

// ---------------------------------------------------------------------
// Coperti (sala e admin)
// ---------------------------------------------------------------------
const coversShape = {
  adults: intMin0,
  children: intMin0,
  kids_menus: intMin0,
};

/** Input del superRefine: i campi sono già numerici (intMin0) ma il tipo di input di preprocess li rende opzionali. */
type Covers = { adults?: number; children?: number; kids_menus?: number };

function checkCovers(v: Covers, ctx: z.RefinementCtx): void {
  const adults = v.adults ?? 0;
  const children = v.children ?? 0;
  const kidsMenus = v.kids_menus ?? 0;
  if (kidsMenus > children) {
    ctx.addIssue({
      code: "custom",
      message: "I menù bambini non possono superare i bambini",
      path: ["kids_menus"],
    });
  }
  if (adults + children < 1) {
    ctx.addIssue({
      code: "custom",
      message: "Indicare almeno un coperto",
      path: ["adults"],
    });
  }
}

export const CoversInput = z.object(coversShape).superRefine(checkCovers);
export type CoversInputType = z.infer<typeof CoversInput>;

// ---------------------------------------------------------------------
// Prenotazione
// ---------------------------------------------------------------------
export const BookingInput = z
  .object({
    client_id: uuidSchema,
    event_name: optText,
    event_date: dateSchema,
    event_time: z.preprocess(emptyToNull, timeSchema.nullable()),
    room_id: optUuid,
    ...coversShape,
    menu_id: optUuid,
    kids_menu_id: optUuid,
    setup_colors: z.array(z.enum(SETUP_COLORS, { message: "Colore non valido" })).max(MAX_ITEMS).default([]),
    setup_notes: optLongText,
    status: z.enum(["opzione", "confermato", "annullato"]).default("opzione"),
    notes: optLongText,
    allergies: z.array(AllergyInput).max(MAX_ITEMS, "Troppe allergie (massimo 60)").default([]),
    /** Se assente e menu_id presente, il backend copia i piatti dal menù. */
    dishes: DishesInput.optional(),
  })
  .superRefine(checkCovers);
export type BookingInputType = z.infer<typeof BookingInput>;

// ---------------------------------------------------------------------
// Operatori
// ---------------------------------------------------------------------
const passwordSchema = z.string().min(8, "La password deve avere almeno 8 caratteri");

export const PasswordInput = z.object({ password: passwordSchema });

export const OperatorInput = z
  .object({
    full_name: z.string().trim().min(2, "Nome troppo corto").max(MAX_TEXT, "Nome troppo lungo"),
    email: z
      .string()
      .trim()
      .pipe(z.email({ message: "Email non valida" }))
      .transform((s) => s.toLowerCase()),
    password: passwordSchema,
    role: z.enum(["sala", "cucina"], { message: "Ruolo non valido" }),
    is_chef: z.boolean().default(false),
  })
  .transform((v) => ({ ...v, is_chef: v.role === "cucina" ? v.is_chef : false }));
export type OperatorInputType = z.infer<typeof OperatorInput>;

export const OperatorUpdateInput = z
  .object({
    full_name: z.string().trim().min(2, "Nome troppo corto").max(MAX_TEXT, "Nome troppo lungo"),
    role: z.enum(["sala", "cucina"], { message: "Ruolo non valido" }),
    is_chef: z.boolean().default(false),
    active: z.boolean(),
  })
  .transform((v) => ({ ...v, is_chef: v.role === "cucina" ? v.is_chef : false }));
export type OperatorUpdateInputType = z.infer<typeof OperatorUpdateInput>;

// ---------------------------------------------------------------------
// Catalogo: menù e sale
// ---------------------------------------------------------------------
export const MenuItemInput = z.object({
  course: courseSchema,
  name: z.string().trim().min(1, "Nome piatto obbligatorio").max(MAX_TEXT, "Nome piatto troppo lungo"),
  sort: intMin0,
});

export const MenuInput = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, "Nome del menù obbligatorio").max(MAX_TEXT, "Nome del menù troppo lungo"),
  season: optText,
  price_per_person: priceSchema,
  is_kids: z.boolean().default(false),
  active: z.boolean().default(true),
  sort: intMin0.default(0),
  items: z.array(MenuItemInput).max(MAX_ITEMS, "Troppe voci (massimo 60)").default([]),
});
export type MenuInputType = z.infer<typeof MenuInput>;

export const RoomInput = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, "Nome sala obbligatorio").max(MAX_TEXT, "Nome sala troppo lungo"),
  capacity: z.preprocess(
    toNumber,
    z.number(numberError("Capienza non valida"))
      .int("Deve essere un numero intero")
      .min(1, "La capienza deve essere almeno 1"),
  ),
  sort: intMin0.default(0),
  active: z.boolean().default(true),
});
export type RoomInputType = z.infer<typeof RoomInput>;

// ---------------------------------------------------------------------
// Preventivi
// ---------------------------------------------------------------------
export const QuoteLineInput = z.object({
  description: z.string().trim().min(1, "Descrizione obbligatoria").max(MAX_TEXT, "Descrizione troppo lunga"),
  quantity: z.preprocess(
    toNumber,
    z
      .number(numberError("Quantità non valida"))
      .gt(0, "La quantità deve essere maggiore di zero")
      .max(100000, "Quantità troppo alta"),
  ),
  unit_price: z.preprocess(
    toNumber,
    z
      .number(numberError("Prezzo non valido"))
      .min(0, "Il prezzo non può essere negativo")
      .max(1000000, "Prezzo unitario troppo alto")
      .transform(round2),
  ),
});

export const QuoteInput = z.object({
  issued_at: dateSchema,
  valid_until: z.preprocess(emptyToNull, dateSchema.nullable()),
  lines: z.array(QuoteLineInput).min(1, "Almeno una riga").max(MAX_ITEMS, "Troppe righe (massimo 60)"),
  discount: z.preprocess(
    toNumber,
    z.number(numberError("Sconto non valido")).min(0, "Lo sconto non può essere negativo").transform(round2),
  ).default(0),
  vat_rate: z.preprocess(
    toNumber,
    z.number(numberError("IVA non valida"))
      .min(0, "L'IVA non può essere negativa")
      .max(100, "L'IVA non può superare 100")
      .transform(round2),
  ).default(10),
  notes: optLongText,
});
export type QuoteInputType = z.infer<typeof QuoteInput>;
