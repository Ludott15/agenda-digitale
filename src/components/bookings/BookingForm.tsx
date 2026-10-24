"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { createBooking, updateBooking } from "@/app/actions/bookings";
import { createClient as createClientAction } from "@/app/actions/clients";
import Link from "next/link";
import { Alert, Button, ButtonLink, Field, Input, Select, Textarea, cn, fieldIds } from "@/components/ui";
import { formatEUR } from "@/lib/quote-utils";
import {
  SETUP_COLORS,
  SETUP_COLOR_HEX,
  STATUS_LABELS,
  type BookingDetail,
  type BookingStatus,
  type ClientOption,
  type Menu,
  type Room,
  type RoomBookingSlot,
} from "@/lib/types";
import { CountStepper } from "./CountStepper";
import { formatTime } from "./format";
import { CourseList } from "./MenuPreview";

export interface BookingFormProps {
  mode: "create" | "edit";
  booking?: BookingDetail;
  clients: ClientOption[];
  rooms: Room[];
  menus: Menu[];
  /** Occupazione sale nella finestra di date (per gli avvisi di sala). */
  occupancy: RoomBookingSlot[];
  initialDate: string;
  initialClientId?: string;
}

type Errors = Record<string, string[]>;
type ClientMode = "existing" | "new";

interface AllergyRow {
  key: string;
  subject_name: string;
  condition: string;
  notes: string;
}

interface NewClient {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  tax_code: string;
  vat_number: string;
  notes: string;
}

interface FormValues {
  clientId: string | null;
  event_name: string;
  event_date: string;
  event_time: string;
  status: BookingStatus;
  adults: number;
  children: number;
  kids_menus: number;
  room_id: string | null;
  menu_id: string | null;
  kids_menu_id: string | null;
  setup_colors: string[];
  setup_notes: string;
  notes: string;
  allergies: AllergyRow[];
}

const EMPTY_NEW_CLIENT: NewClient = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  tax_code: "",
  vat_number: "",
  notes: "",
};

let rowSeq = 0;
const nextKey = (): string => `row-${++rowSeq}`;

/** Id HTML stabile derivato dal nome campo (es. "allergies.0.condition" → "allergies-0-condition"). */
const idFor = (key: string): string => key.replace(/[^a-zA-Z0-9_-]/g, "-");

/** Campi il cui id DOM non coincide con il nome del campo errore. */
const FOCUS_TARGETS: Record<string, string> = { client_id: "client-search" };

const first = (messages: string[] | undefined): string | undefined => messages?.[0];

/** aria-describedby di un input: punta all'errore se presente, altrimenti all'hint. */
const describedBy = (htmlFor: string, error?: string, hasHint = false): string | undefined => {
  const ids = fieldIds(htmlFor);
  if (error) return ids.errorId;
  return hasHint ? ids.hintId : undefined;
};

const isBlankAllergy = (a: AllergyRow): boolean =>
  !a.subject_name.trim() && !a.condition.trim() && !a.notes.trim();

function initialValues(
  booking: BookingDetail | undefined,
  initialDate: string,
  initialClientId: string | undefined,
): FormValues {
  if (booking) {
    return {
      clientId: booking.client_id,
      event_name: booking.event_name ?? "",
      event_date: booking.event_date,
      event_time: formatTime(booking.event_time) ?? "",
      status: booking.status,
      adults: booking.adults,
      children: booking.children,
      kids_menus: booking.kids_menus,
      room_id: booking.room_id,
      menu_id: booking.menu_id,
      kids_menu_id: booking.kids_menu_id,
      setup_colors: [...booking.setup_colors],
      setup_notes: booking.setup_notes ?? "",
      notes: booking.notes ?? "",
      allergies: booking.allergies.map((a) => ({
        key: nextKey(),
        subject_name: a.subject_name ?? "",
        condition: a.condition,
        notes: a.notes ?? "",
      })),
    };
  }
  return {
    clientId: initialClientId ?? null,
    event_name: "",
    event_date: initialDate,
    event_time: "",
    status: "opzione",
    adults: 0,
    children: 0,
    kids_menus: 0,
    room_id: null,
    menu_id: null,
    kids_menu_id: null,
    setup_colors: [],
    setup_notes: "",
    notes: "",
    allergies: [],
  };
}

function validate(v: FormValues, clientMode: ClientMode, nc: NewClient): Errors {
  const errors: Errors = {};
  const add = (key: string, message: string) => {
    (errors[key] ??= []).push(message);
  };

  if (clientMode === "existing") {
    if (!v.clientId) add("client_id", "Seleziona un cliente");
  } else {
    if (!nc.first_name.trim()) add("new.first_name", "Nome obbligatorio");
    if (!nc.last_name.trim()) add("new.last_name", "Cognome obbligatorio");
    if (nc.phone.trim().length < 6) add("new.phone", "Telefono obbligatorio (minimo 6 caratteri)");
  }
  if (!v.event_date) add("event_date", "Data obbligatoria");
  if (v.adults + v.children < 1) add("adults", "Indicare almeno un coperto");
  if (v.kids_menus > v.children) add("kids_menus", "I menù bambini non possono superare i bambini");
  v.allergies.forEach((a, index) => {
    if (!isBlankAllergy(a) && !a.condition.trim()) {
      add(`allergies.${index}.condition`, "Indicare la condizione");
    }
  });
  return errors;
}

/** Avvisi non bloccanti: sala già occupata quella data, coperti sopra capienza. */
function roomWarnings(
  v: FormValues,
  rooms: Room[],
  occupancy: RoomBookingSlot[],
  bookingId: string | undefined,
): string[] {
  const room = rooms.find((r) => r.id === v.room_id);
  if (!room || !v.event_date) return [];
  const warnings: string[] = [];

  const clashes = occupancy.filter(
    (b) => b.room_id === room.id && b.event_date === v.event_date && b.id !== bookingId,
  );
  if (clashes.length > 0) {
    const names = clashes.map((b) => b.event_name?.trim() || b.client_name).join(", ");
    warnings.push(
      `${room.name} è già assegnata in questa data a: ${names}. Ogni sala è riservata a un singolo evento.`,
    );
  }

  const covers = v.adults + v.children;
  if (covers > room.capacity) {
    warnings.push(`${covers} coperti superano la capienza di ${room.name} (${room.capacity}).`);
  }
  return warnings;
}

function buildPayload(v: FormValues, clientId: string) {
  return {
    client_id: clientId,
    event_name: v.event_name.trim() || null,
    event_date: v.event_date,
    event_time: v.event_time || null,
    room_id: v.room_id,
    adults: v.adults,
    children: v.children,
    kids_menus: v.kids_menus,
    menu_id: v.menu_id,
    kids_menu_id: v.kids_menu_id,
    setup_colors: v.setup_colors,
    setup_notes: v.setup_notes.trim() || null,
    status: v.status,
    notes: v.notes.trim() || null,
    allergies: v.allergies
      .filter((a) => !isBlankAllergy(a))
      .map((a) => ({
        subject_name: a.subject_name.trim() || null,
        condition: a.condition.trim(),
        notes: a.notes.trim() || null,
      })),
    // `dishes` non viene inviato: alla creazione il backend copia i piatti dal menù,
    // in modifica i piatti personalizzati restano quelli salvati.
  };
}

/** Gli errori di allergie arrivano con l'indice della lista filtrata: riporto l'indice della riga nel form. */
function mapBookingErrors(fieldErrors: Errors | undefined, activeIndexes: number[]): Errors {
  const out: Errors = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    const match = /^allergies\.(\d+)\.(.+)$/.exec(key);
    if (match) {
      const original = activeIndexes[Number(match[1])] ?? Number(match[1]);
      out[`allergies.${original}.${match[2]}`] = messages;
    } else {
      out[key] = messages;
    }
  }
  return out;
}

function prefixErrors(fieldErrors: Errors | undefined, prefix: string): Errors {
  return Object.fromEntries(
    Object.entries(fieldErrors ?? {}).map(([key, messages]) => [`${prefix}${key}`, messages]),
  );
}

function toClientOption(id: string, c: NewClient): ClientOption {
  return {
    id,
    first_name: c.first_name.trim(),
    last_name: c.last_name.trim(),
    phone: c.phone.trim(),
  };
}

function focusField(key: string | undefined): void {
  if (!key) return;
  document.getElementById(FOCUS_TARGETS[key] ?? idFor(key))?.focus();
}

/** Messaggio quando un elenco di sale o menù attivi è vuoto, con rimando al catalogo. */
function CatalogHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-btn border border-dashed border-slate/40 px-4 py-4 text-[14px] text-slate-dark">
      {children}{" "}
      <Link href="/catalogo" className="font-medium text-petrol underline-offset-2 hover:underline">
        Vai al catalogo
      </Link>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Componenti locali di presentazione
// ---------------------------------------------------------------------------

function FormSection({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-6 rounded-[2px] border border-sand bg-paper p-5 shadow-sm shadow-ink/5 sm:p-7"
    >
      <header className="flex flex-col gap-1 border-b border-sand pb-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-bronze">{eyebrow}</p>
        <h2 id={id} className="text-2xl">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

/** Scelta singola a card (radio nascosto + card visiva, accessibile da tastiera). */
function ChoiceCard({
  name,
  checked,
  onSelect,
  title,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  children?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col gap-3 rounded-btn border bg-paper p-4 transition-colors duration-200 hover:border-slate focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-petrol",
        checked ? "border-petrol bg-petrol/5 ring-1 ring-petrol" : "border-sand",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={() => onSelect()}
        className="sr-only"
      />
      <span className="flex items-start justify-between gap-3">
        <span className="font-serif text-xl leading-tight text-ink">{title}</span>
        {checked && <Check aria-hidden="true" className="size-5 shrink-0 text-petrol" />}
      </span>
      {children}
    </label>
  );
}

function ToggleOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-btn px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors duration-200 sm:flex-none",
        active ? "bg-petrol text-paper" : "text-petrol hover:bg-cream",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export function BookingForm({
  mode,
  booking,
  clients,
  rooms,
  menus,
  occupancy,
  initialDate,
  initialClientId,
}: BookingFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(booking, initialDate, initialClientId),
  );
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [newClient, setNewClient] = useState<NewClient>(EMPTY_NEW_CLIENT);
  const [localClients, setLocalClients] = useState<ClientOption[]>([]);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const patch = (changes: Partial<FormValues>) => setValues((v) => ({ ...v, ...changes }));

  // Clienti: quelli appena creati in questa sessione + la lista dal server.
  const allClients: ClientOption[] = [
    ...localClients,
    ...clients.filter((c) => !localClients.some((l) => l.id === c.id)),
  ];
  const selectedClient: ClientOption | undefined =
    allClients.find((c) => c.id === values.clientId) ??
    (booking && booking.client_id === values.clientId ? booking.client : undefined);

  const normalizedQuery = query.trim().toLowerCase();
  const queryDigits = normalizedQuery.replace(/\D/g, "");
  const clientOptions = allClients
    .filter((c) => {
      if (!normalizedQuery) return true;
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      return (
        name.includes(normalizedQuery) ||
        (queryDigits.length > 0 && c.phone.replace(/\D/g, "").includes(queryDigits))
      );
    })
    .slice(0, 50);

  // Sale e menù: attivi + eventualmente quello già selezionato (anche se disattivato).
  const roomOptions = rooms.filter((r) => r.active || r.id === values.room_id);
  const adultMenus = menus.filter((m) => !m.is_kids && (m.active || m.id === values.menu_id));
  const kidsMenuOptions = menus.filter((m) => m.is_kids && (m.active || m.id === values.kids_menu_id));

  const warnings = roomWarnings(values, rooms, occupancy, booking?.id);
  const hasActiveRooms = rooms.some((r) => r.active);
  const hasActiveAdultMenus = adultMenus.some((m) => m.active);
  const hasActiveKidsMenus = kidsMenuOptions.some((m) => m.active);

  const toggleColor = (color: string) =>
    patch({
      setup_colors: values.setup_colors.includes(color)
        ? values.setup_colors.filter((c) => c !== color)
        : [...values.setup_colors, color],
    });

  const updateAllergy = (index: number, changes: Partial<Omit<AllergyRow, "key">>) =>
    patch({
      allergies: values.allergies.map((a, i) => (i === index ? { ...a, ...changes } : a)),
    });

  const addAllergy = () =>
    patch({
      allergies: [...values.allergies, { key: nextKey(), subject_name: "", condition: "", notes: "" }],
    });

  const removeAllergy = (index: number) =>
    patch({ allergies: values.allergies.filter((_, i) => i !== index) });

  const newClientInput = (field: Exclude<keyof NewClient, "notes">) => ({
    value: newClient[field],
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setNewClient((c) => ({ ...c, [field]: e.target.value })),
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const localErrors = validate(values, clientMode, newClient);
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      setFormError("Controlla i campi evidenziati.");
      focusField(Object.keys(localErrors)[0]);
      return;
    }

    const activeIndexes = values.allergies.flatMap((a, i) => (isBlankAllergy(a) ? [] : [i]));

    startTransition(async () => {
      let clientId = values.clientId;

      // Nuovo cliente: creato prima della prenotazione. Se poi la prenotazione fallisce,
      // il cliente resta creato e il form passa su "Cliente esistente" (niente duplicati al retry).
      if (clientMode === "new") {
        const created = await createClientAction(newClient);
        if (!created.ok) {
          setErrors(prefixErrors(created.fieldErrors, "new."));
          setFormError(created.error);
          return;
        }
        clientId = created.data.id;
        setLocalClients((prev) => [toClientOption(created.data.id, newClient), ...prev]);
        setValues((v) => ({ ...v, clientId: created.data.id }));
        setClientMode("existing");
      }

      if (!clientId) {
        setFormError("Seleziona un cliente.");
        return;
      }

      const payload = buildPayload(values, clientId);

      if (booking) {
        const result = await updateBooking(booking.id, payload);
        if (!result.ok) {
          setErrors(mapBookingErrors(result.fieldErrors, activeIndexes));
          setFormError(result.error);
          return;
        }
        router.push(`/prenotazioni/${booking.id}`);
        return;
      }

      const result = await createBooking(payload);
      if (!result.ok) {
        setErrors(mapBookingErrors(result.fieldErrors, activeIndexes));
        setFormError(result.error);
        return;
      }
      router.push(`/prenotazioni/${result.data.id}`);
    });
  };

  const cancelHref = booking ? `/prenotazioni/${booking.id}` : `/agenda?date=${initialDate}&view=day`;
  const totalCovers = values.adults + values.children;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8" aria-label={mode === "edit" ? "Modifica prenotazione" : "Nuova prenotazione"}>
      {formError && <Alert tone="danger">{formError}</Alert>}

      {/* 01 · Cliente */}
      <FormSection id="sec-cliente" eyebrow="01 · Cliente" title="Chi prenota">
        <div className="flex flex-col gap-5">
          <div role="group" aria-label="Tipo cliente" className="inline-flex w-full rounded-btn border border-petrol p-0.5 sm:w-auto">
            <ToggleOption active={clientMode === "existing"} onClick={() => setClientMode("existing")}>
              Cliente esistente
            </ToggleOption>
            <ToggleOption active={clientMode === "new"} onClick={() => setClientMode("new")}>
              Nuovo cliente
            </ToggleOption>
          </div>

          {clientMode === "existing" ? (
            <div className="flex flex-col gap-4">
              {selectedClient && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-btn border border-petrol bg-petrol/5 px-4 py-3">
                  <p className="text-[15px] text-ink">
                    <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-bronze">Selezionato</span>
                    <span className="block font-medium">
                      {selectedClient.first_name} {selectedClient.last_name} · {selectedClient.phone}
                    </span>
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => patch({ clientId: null })} aria-label="Rimuovi cliente selezionato">
                    <X aria-hidden="true" className="size-4" />
                    Rimuovi
                  </Button>
                </div>
              )}

              <Field label="Cerca cliente" htmlFor="client-search" hint="Cerca per nome, cognome o telefono">
                <div className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
                  <Input
                    id="client-search"
                    type="search"
                    autoComplete="off"
                    aria-describedby={describedBy("client-search", undefined, true)}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="es. Rossi, 340…"
                    className="pl-10"
                  />
                </div>
              </Field>

              {clientOptions.length === 0 ? (
                <p className="rounded-btn border border-dashed border-slate/40 px-4 py-6 text-center text-[14px] text-slate">
                  Nessun cliente corrisponde alla ricerca. Usa «Nuovo cliente» per crearlo.
                </p>
              ) : (
                <ul className="flex max-h-72 flex-col divide-y divide-sand overflow-y-auto rounded-btn border border-sand bg-paper">
                  {clientOptions.map((c) => {
                    const active = c.id === values.clientId;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => patch({ clientId: c.id })}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-cream",
                            active && "bg-petrol/5",
                          )}
                        >
                          <span className="flex flex-col">
                            <span className="font-medium text-ink">
                              {c.first_name} {c.last_name}
                            </span>
                            <span className="text-[13px] text-slate-dark">{c.phone}</span>
                          </span>
                          {active && <Check aria-hidden="true" className="size-5 shrink-0 text-petrol" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {errors.client_id && (
                <p className="text-[13px] text-danger">{first(errors.client_id)}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nome" htmlFor={idFor("new.first_name")} required error={first(errors["new.first_name"])}>
                <Input id={idFor("new.first_name")} autoComplete="off" invalid={!!errors["new.first_name"]} aria-describedby={describedBy(idFor("new.first_name"), first(errors["new.first_name"]))} {...newClientInput("first_name")} />
              </Field>
              <Field label="Cognome" htmlFor={idFor("new.last_name")} required error={first(errors["new.last_name"])}>
                <Input id={idFor("new.last_name")} autoComplete="off" invalid={!!errors["new.last_name"]} aria-describedby={describedBy(idFor("new.last_name"), first(errors["new.last_name"]))} {...newClientInput("last_name")} />
              </Field>
              <Field label="Telefono" htmlFor={idFor("new.phone")} required error={first(errors["new.phone"])} hint="Es. +39 340 1234567">
                <Input id={idFor("new.phone")} type="tel" autoComplete="off" invalid={!!errors["new.phone"]} aria-describedby={describedBy(idFor("new.phone"), first(errors["new.phone"]), true)} {...newClientInput("phone")} />
              </Field>
              <Field label="Email" htmlFor={idFor("new.email")} error={first(errors["new.email"])}>
                <Input id={idFor("new.email")} type="email" autoComplete="off" invalid={!!errors["new.email"]} aria-describedby={describedBy(idFor("new.email"), first(errors["new.email"]))} {...newClientInput("email")} />
              </Field>
              <Field label="Codice fiscale" htmlFor={idFor("new.tax_code")} error={first(errors["new.tax_code"])}>
                <Input id={idFor("new.tax_code")} autoComplete="off" invalid={!!errors["new.tax_code"]} aria-describedby={describedBy(idFor("new.tax_code"), first(errors["new.tax_code"]))} {...newClientInput("tax_code")} />
              </Field>
              <Field label="Partita IVA" htmlFor={idFor("new.vat_number")} error={first(errors["new.vat_number"])}>
                <Input id={idFor("new.vat_number")} inputMode="numeric" autoComplete="off" invalid={!!errors["new.vat_number"]} aria-describedby={describedBy(idFor("new.vat_number"), first(errors["new.vat_number"]))} {...newClientInput("vat_number")} />
              </Field>
              <Field label="Note sul cliente" htmlFor={idFor("new.notes")} className="sm:col-span-2">
                <Textarea
                  id={idFor("new.notes")}
                  rows={2}
                  value={newClient.notes}
                  onChange={(e) => setNewClient((c) => ({ ...c, notes: e.target.value }))}
                />
              </Field>
            </div>
          )}
        </div>
      </FormSection>

      {/* 02 · Evento */}
      <FormSection id="sec-evento" eyebrow="02 · Evento" title="Data e stato">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome evento" htmlFor="event_name" error={first(errors.event_name)}>
            <Input id="event_name" invalid={!!errors.event_name} aria-describedby={describedBy("event_name", first(errors.event_name))} value={values.event_name} onChange={(e) => patch({ event_name: e.target.value })} placeholder="es. Matrimonio Rossi" />
          </Field>
          <Field label="Stato" htmlFor="status" error={first(errors.status)}>
            <Select id="status" invalid={!!errors.status} aria-describedby={describedBy("status", first(errors.status))} value={values.status} onChange={(e) => patch({ status: e.target.value as BookingStatus })}>
              {(Object.keys(STATUS_LABELS) as BookingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data evento" htmlFor="event_date" required error={first(errors.event_date)}>
            <Input
              id="event_date"
              type="date"
              required
              invalid={!!errors.event_date}
              aria-describedby={describedBy("event_date", first(errors.event_date))}
              value={values.event_date}
              onChange={(e) => patch({ event_date: e.target.value })}
            />
          </Field>
          <Field label="Ora" htmlFor="event_time" error={first(errors.event_time)} hint="Facoltativa">
            <Input id="event_time" type="time" invalid={!!errors.event_time} aria-describedby={describedBy("event_time", first(errors.event_time), true)} value={values.event_time} onChange={(e) => patch({ event_time: e.target.value })} />
          </Field>
        </div>
      </FormSection>

      {/* 03 · Coperti */}
      <FormSection id="sec-coperti" eyebrow="03 · Coperti" title="Quanti saranno">
        <div className="grid gap-6 sm:grid-cols-3">
          <CountStepper
            id="adults"
            label="Adulti"
            value={values.adults}
            onChange={(n) => patch({ adults: n })}
            error={first(errors.adults)}
          />
          <CountStepper
            id="children"
            label="Bambini"
            value={values.children}
            onChange={(n) => patch({ children: n, kids_menus: Math.min(values.kids_menus, n) })}
          />
          <CountStepper
            id="kids_menus"
            label="Menù bambini"
            value={values.kids_menus}
            max={values.children}
            onChange={(n) => patch({ kids_menus: n })}
            hint="Non può superare il numero di bambini"
            error={first(errors.kids_menus)}
          />
        </div>
        <p className="text-[14px] text-slate-dark">
          Totale coperti:{" "}
          <span className="font-serif text-2xl tabular-nums text-ink">{totalCovers}</span>
        </p>
      </FormSection>

      {/* 04 · Sala */}
      <FormSection id="sec-sala" eyebrow="04 · Sala" title="Dove si svolge">
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">Sala</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ChoiceCard name="room_id" title="Da assegnare" checked={values.room_id === null} onSelect={() => patch({ room_id: null })}>
              <span className="text-[14px] text-slate-dark">Sala non ancora scelta</span>
            </ChoiceCard>
            {roomOptions.map((room) => (
              <ChoiceCard
                key={room.id}
                name="room_id"
                title={room.name}
                checked={values.room_id === room.id}
                onSelect={() => patch({ room_id: room.id })}
              >
                <span className="text-[14px] text-slate-dark">Fino a {room.capacity} coperti</span>
              </ChoiceCard>
            ))}
          </div>
          {!hasActiveRooms && (
            <CatalogHint>Nessuna sala attiva. Si può salvare comunque senza assegnare una sala.</CatalogHint>
          )}
          {first(errors.room_id) && <p className="text-[13px] text-danger">{first(errors.room_id)}</p>}
          {warnings.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}
        </fieldset>
      </FormSection>

      {/* 05 · Allestimento */}
      <FormSection id="sec-allestimento" eyebrow="05 · Allestimento" title="Colori e descrizione">
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">Colori (scelta multipla)</p>
          <div role="group" aria-label="Colori allestimento" className="flex flex-wrap gap-2">
            {SETUP_COLORS.map((color) => {
              const on = values.setup_colors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleColor(color)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-btn border px-3 py-1.5 text-[14px] transition-colors duration-200",
                    on ? "border-petrol bg-petrol/10 text-ink" : "border-slate/40 bg-paper text-slate-dark hover:border-slate",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-full ring-1 ring-ink/25"
                    style={{ backgroundColor: SETUP_COLOR_HEX[color] }}
                  />
                  {color}
                  {on && <Check aria-hidden="true" className="size-3.5 text-petrol" />}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Descrizione allestimento" htmlFor="setup_notes" error={first(errors.setup_notes)}>
          <Textarea id="setup_notes" rows={3} value={values.setup_notes} onChange={(e) => patch({ setup_notes: e.target.value })} placeholder="Tovaglie, centrotavola, composizioni floreali…" />
        </Field>
      </FormSection>

      {/* 06 · Menù */}
      <FormSection id="sec-menu" eyebrow="06 · Menù" title="Scelta del menù">
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">Menù adulti</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard name="menu_id" title="Da definire" checked={values.menu_id === null} onSelect={() => patch({ menu_id: null })}>
              <span className="text-[14px] text-slate-dark">Nessun menù per ora</span>
            </ChoiceCard>
            {adultMenus.map((menu) => (
              <ChoiceCard key={menu.id} name="menu_id" title={menu.name} checked={values.menu_id === menu.id} onSelect={() => patch({ menu_id: menu.id })}>
                <span className="text-[14px] font-medium text-petrol">{formatEUR(menu.price_per_person)} a persona</span>
                <CourseList items={menu.items} className="text-[13px]" />
              </ChoiceCard>
            ))}
          </div>
          {!hasActiveAdultMenus && (
            <CatalogHint>Nessun menù adulti attivo. Si può salvare comunque con menù da definire.</CatalogHint>
          )}
          {first(errors.menu_id) && <p className="text-[13px] text-danger">{first(errors.menu_id)}</p>}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">Menù bambini</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard name="kids_menu_id" title="Nessuno" checked={values.kids_menu_id === null} onSelect={() => patch({ kids_menu_id: null })}>
              <span className="text-[14px] text-slate-dark">Nessun menù bambini</span>
            </ChoiceCard>
            {kidsMenuOptions.map((menu) => (
              <ChoiceCard key={menu.id} name="kids_menu_id" title={menu.name} checked={values.kids_menu_id === menu.id} onSelect={() => patch({ kids_menu_id: menu.id })}>
                <span className="text-[14px] font-medium text-petrol">{formatEUR(menu.price_per_person)} a bambino</span>
                <CourseList items={menu.items} className="text-[13px]" />
              </ChoiceCard>
            ))}
          </div>
          {!hasActiveKidsMenus && <CatalogHint>Nessun menù bambini attivo.</CatalogHint>}
          {first(errors.kids_menu_id) && <p className="text-[13px] text-danger">{first(errors.kids_menu_id)}</p>}
        </div>

        <p className="rounded-btn bg-cream/70 px-4 py-3 text-[14px] leading-relaxed text-slate-dark">
          {booking
            ? "Cambiando menù, i piatti dell’evento vengono riallineati al nuovo menù. Le personalizzazioni (nome piatti, portate) si gestiscono dalla pagina della prenotazione."
            : "Alla creazione i piatti dell’evento vengono copiati dal menù scelto e possono essere personalizzati dalla pagina della prenotazione."}
        </p>
      </FormSection>

      {/* 07 · Allergie e patologie */}
      <FormSection id="sec-allergie" eyebrow="07 · Allergie" title="Allergie e patologie">
        <div className="flex flex-col gap-4">
          {values.allergies.length === 0 && (
            <p className="text-[14px] text-slate">Nessuna allergia o patologia segnalata.</p>
          )}
          {values.allergies.map((row, index) => {
            const conditionId = idFor(`allergies.${index}.condition`);
            const subjectId = idFor(`allergies.${index}.subject_name`);
            const notesId = idFor(`allergies.${index}.notes`);
            return (
              <div key={row.key} className="grid gap-4 rounded-btn border border-sand bg-paper p-4 sm:grid-cols-2">
                <Field label="Soggetto" htmlFor={subjectId} hint="Lasciare vuoto se riguarda il cliente">
                  <Input id={subjectId} aria-describedby={describedBy(subjectId, undefined, true)} value={row.subject_name} onChange={(e) => updateAllergy(index, { subject_name: e.target.value })} placeholder="es. Maria, figlio…" />
                </Field>
                <Field label="Allergia o patologia" htmlFor={conditionId} required error={first(errors[`allergies.${index}.condition`])}>
                  <Input
                    id={conditionId}
                    invalid={!!errors[`allergies.${index}.condition`]}
                    aria-describedby={describedBy(conditionId, first(errors[`allergies.${index}.condition`]))}
                    value={row.condition}
                    onChange={(e) => updateAllergy(index, { condition: e.target.value })}
                    placeholder="es. Celiachia, lattosio…"
                  />
                </Field>
                <Field label="Note" htmlFor={notesId} className="sm:col-span-2">
                  <Input id={notesId} value={row.notes} onChange={(e) => updateAllergy(index, { notes: e.target.value })} />
                </Field>
                <div className="flex justify-end sm:col-span-2">
                  <Button variant="ghost" size="sm" onClick={() => removeAllergy(index)}>
                    <Trash2 aria-hidden="true" className="size-4" />
                    Rimuovi
                  </Button>
                </div>
              </div>
            );
          })}
          <div>
            <Button variant="outline" size="sm" onClick={addAllergy}>
              <Plus aria-hidden="true" className="size-4" />
              Aggiungi allergia o patologia
            </Button>
          </div>
        </div>
      </FormSection>

      {/* 08 · Note */}
      <FormSection id="sec-note" eyebrow="08 · Note" title="Note interne">
        <Field label="Note" htmlFor="notes" error={first(errors.notes)}>
          <Textarea id="notes" rows={4} value={values.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-3 border-t border-sand pt-6 sm:flex-row sm:items-center sm:justify-between">
        <ButtonLink href={cancelHref} variant="ghost" size="md">
          Annulla
        </ButtonLink>
        <Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Salvataggio…" : mode === "edit" ? "Salva modifiche" : "Crea prenotazione"}
        </Button>
      </div>
    </form>
  );
}
