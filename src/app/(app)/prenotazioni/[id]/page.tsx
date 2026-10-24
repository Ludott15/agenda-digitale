import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { capitalize, formatIt, toDate } from "@/components/agenda/agenda-utils";
import { BookingChangesTimeline } from "@/components/bookings/BookingChangesTimeline";
import { CoversEditor } from "@/components/bookings/CoversEditor";
import { DeleteBookingButton } from "@/components/bookings/DeleteBookingButton";
import { DishesEditor } from "@/components/bookings/DishesEditor";
import { CreateQuoteButton } from "@/components/bookings/QuoteActions";
import { CourseList } from "@/components/bookings/MenuPreview";
import { bookingTitle, formatTime } from "@/components/bookings/format";
import type { NameLookup } from "@/components/bookings/change-labels";
import { Badge, ButtonLink, Card, StatusBadge, buttonClasses, cn } from "@/components/ui";
import { isUuid } from "@/lib/action-utils";
import { canEditCovers, canEditDishes, isAdmin } from "@/lib/permissions";
import { requireProfile } from "@/lib/auth";
import { getBooking, getBookingChanges } from "@/lib/data/bookings";
import { getMenus, getRooms } from "@/lib/data/catalog";
import { getQuotesForBooking } from "@/lib/data/quotes";
import { computeQuoteTotals, formatEUR } from "@/lib/quote-utils";
import { SETUP_COLOR_HEX } from "@/lib/types";

export const metadata: Metadata = {
  title: "Prenotazione · Casale del Notaio",
};

/** Numero WhatsApp in formato internazionale senza simboli (wa.me). Default prefisso Italia. */
function whatsappHref(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (!digits.startsWith("39") && digits.length <= 10) digits = `39${digits}`;
  return `https://wa.me/${digits}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+0-9]/g, "")}`;
}

function DetailCard({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-5 p-5 sm:p-6", className)}>
      <header className="flex flex-col gap-1 border-b border-sand pb-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">{eyebrow}</p>
        <h2 className="text-2xl">{title}</h2>
      </header>
      {children}
    </Card>
  );
}

function CoverTile({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[2px] border p-4",
        emphasis ? "border-petrol bg-petrol text-paper" : "border-sand bg-cream/40 text-ink",
      )}
    >
      <dt className={cn("text-[11px] font-medium uppercase tracking-[0.14em]", emphasis ? "text-sand" : "text-bronze")}>
        {label}
      </dt>
      <dd className="font-serif text-4xl tabular-nums leading-none sm:text-5xl">{value}</dd>
    </div>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  if (!isUuid(id)) notFound();

  const booking = await getBooking(id);
  if (!booking) notFound();

  const admin = isAdmin(profile);
  const covers = canEditCovers(profile);
  const dishesEditable = canEditDishes(profile);

  const [changes, rooms, menus, quotes] = await Promise.all([
    getBookingChanges(id),
    getRooms({ includeInactive: true }),
    getMenus({ includeInactive: true }),
    admin ? getQuotesForBooking(id) : Promise.resolve([]),
  ]);

  const client = booking.client;
  const clientName = `${client.first_name} ${client.last_name}`;
  const eventDate = toDate(booking.event_date);
  const time = formatTime(booking.event_time);
  const totalCovers = booking.adults + booking.children;
  const dishesVersion = `${booking.menu_id ?? ""}|${booking.dishes
    .map((d) => `${d.id}:${d.course}:${d.name}:${d.sort}`)
    .join("|")}`;

  const lookup: NameLookup = {
    rooms: Object.fromEntries(rooms.map((r) => [r.id, r.name])),
    menus: Object.fromEntries(menus.map((m) => [m.id, m.name])),
    clients: { [booking.client_id]: clientName },
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 border-b border-sand pb-8">
        <Link
          href={`/agenda?date=${booking.event_date}&view=day`}
          className="w-fit rounded-[2px] text-[13px] font-medium text-petrol underline-offset-4 hover:underline"
        >
          ← Torna all’agenda
        </Link>

        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-bronze">
            {capitalize(formatIt(eventDate, "EEEE d MMMM yyyy"))}
            {time ? ` · ore ${time}` : ""}
          </p>
          <h1 className="text-3xl leading-tight sm:text-4xl lg:text-5xl">{bookingTitle(booking)}</h1>
          {booking.event_name && <p className="text-[15px] text-slate-dark">{clientName}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            {booking.room ? (
              <Badge tone="petrol">{booking.room.name}</Badge>
            ) : (
              <Badge tone="neutral">Sala da assegnare</Badge>
            )}
          </div>
        </div>

        {admin && (
          <div className="no-print flex flex-wrap gap-3">
            <ButtonLink href={`/prenotazioni/${booking.id}/modifica`} variant="outline" size="md">
              Modifica
            </ButtonLink>
            <DeleteBookingButton bookingId={booking.id} />
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <DetailCard eyebrow="Coperti" title="Numeri dell’evento">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CoverTile label="Adulti" value={booking.adults} />
              <CoverTile label="Bambini" value={booking.children} />
              <CoverTile label="Menù bambini" value={booking.kids_menus} />
              <CoverTile label="Totale coperti" value={totalCovers} emphasis />
            </dl>
            {covers && (
              <div className="no-print border-t border-sand pt-5">
                <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">
                  Modifica coperti
                </p>
                <CoversEditor
                  key={`${booking.adults}-${booking.children}-${booking.kids_menus}`}
                  bookingId={booking.id}
                  adults={booking.adults}
                  childCount={booking.children}
                  kidsMenus={booking.kids_menus}
                />
              </div>
            )}
          </DetailCard>

          {booking.allergies.length > 0 && (
            <section
              aria-labelledby="allergie-title"
              className="flex flex-col gap-4 rounded-[2px] border-l-[3px] border-danger bg-danger/5 p-5 sm:p-6"
            >
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-danger">Attenzione</p>
                <h2 id="allergie-title" className="text-2xl">
                  Allergie e patologie
                </h2>
              </div>
              <ul className="flex flex-col gap-3">
                {booking.allergies.map((allergy) => (
                  <li key={allergy.id} className="text-[15px] leading-snug text-ink">
                    <span className="font-medium">{allergy.condition}</span>
                    {allergy.subject_name && <span className="text-slate-dark"> · {allergy.subject_name}</span>}
                    {allergy.notes && <span className="block text-[14px] text-slate-dark">{allergy.notes}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <DetailCard eyebrow="Menù" title="Menù e piatti">
            <div className="flex flex-col gap-1">
              <p className="text-[15px]">
                <span className="font-medium text-ink">{booking.menu?.name ?? "Menù non selezionato"}</span>
                {booking.menu && (
                  <span className="text-slate-dark"> · {formatEUR(booking.menu.price_per_person)} a persona</span>
                )}
              </p>
            </div>

            {dishesEditable ? (
              <DishesEditor
                key={dishesVersion}
                bookingId={booking.id}
                dishes={booking.dishes}
                hasMenu={booking.menu_id !== null}
              />
            ) : (
              <CourseList items={booking.dishes} />
            )}

            {booking.kids_menu && (
              <div className="flex flex-col gap-3 border-t border-sand pt-4">
                <p className="text-[15px]">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Menù bambini </span>
                  <span className="font-medium text-ink">{booking.kids_menu.name}</span>
                  <span className="text-slate-dark"> · {formatEUR(booking.kids_menu.price_per_person)} a bambino</span>
                </p>
                <CourseList items={booking.kids_menu.items} />
              </div>
            )}
          </DetailCard>
        </div>

        <div className="flex flex-col gap-6">
          <DetailCard eyebrow="Cliente" title={clientName}>
            <ul className="flex flex-col gap-3 text-[15px]">
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">Telefono</span>
                <a href={telHref(client.phone)} className="font-medium text-petrol underline-offset-4 hover:underline">
                  {client.phone}
                </a>
              </li>
              {client.email && (
                <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">Email</span>
                  <a href={`mailto:${client.email}`} className="break-all text-petrol underline-offset-4 hover:underline">
                    {client.email}
                  </a>
                </li>
              )}
              {client.tax_code && (
                <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">Codice fiscale</span>
                  <span className="font-mono text-[14px]">{client.tax_code}</span>
                </li>
              )}
              {client.vat_number && (
                <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">P.IVA</span>
                  <span className="font-mono text-[14px]">{client.vat_number}</span>
                </li>
              )}
              {client.notes && <li className="text-[14px] text-slate-dark">{client.notes}</li>}
            </ul>
            <div className="no-print flex flex-wrap gap-3">
              <a href={telHref(client.phone)} className={buttonClasses("outline", "sm")}>
                Chiama
              </a>
              <a
                href={whatsappHref(client.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("outline", "sm", "rounded-none")}
              >
                WhatsApp
              </a>
              {admin && (
                <ButtonLink href={`/clienti/${client.id}`} variant="ghost" size="sm">
                  Scheda cliente
                </ButtonLink>
              )}
            </div>
          </DetailCard>

          <DetailCard eyebrow="Allestimento" title="Colori e descrizione">
            {booking.setup_colors.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Colori scelti">
                {booking.setup_colors.map((name) => (
                  <li
                    key={name}
                    className="inline-flex items-center gap-2 rounded-btn border border-sand bg-paper px-2.5 py-1 text-[13px] text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="size-3.5 rounded-full ring-1 ring-ink/25"
                      style={{ backgroundColor: SETUP_COLOR_HEX[name as keyof typeof SETUP_COLOR_HEX] ?? "#B0B0B0" }}
                    />
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-slate">Nessun colore scelto.</p>
            )}
            {booking.setup_notes && (
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{booking.setup_notes}</p>
            )}
          </DetailCard>

          {booking.notes && (
            <DetailCard eyebrow="Note" title="Note interne">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{booking.notes}</p>
            </DetailCard>
          )}

          {admin && (
            <DetailCard eyebrow="Preventivi" title="Preventivi">
              {quotes.length === 0 ? (
                <p className="text-[14px] text-slate">Nessun preventivo emesso per questa prenotazione.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-sand">
                  {quotes.map((quote) => {
                    const totals = computeQuoteTotals(quote);
                    return (
                      <li key={quote.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col">
                          <p className="font-medium text-ink">n. {quote.number}</p>
                          <p className="text-[13px] text-slate-dark">
                            Emesso il {formatIt(toDate(quote.issued_at), "d MMM yyyy")} · {formatEUR(totals.total)} IVA inclusa
                          </p>
                        </div>
                        <div className="no-print flex flex-wrap gap-2">
                          <ButtonLink href={`/preventivi/${quote.id}`} variant="ghost" size="sm">
                            Apri
                          </ButtonLink>
                          <a href={`/api/quotes/${quote.id}/pdf`} download className={buttonClasses("outline", "sm")}>
                            PDF
                          </a>
                          <a href={`/api/quotes/${quote.id}/docx`} download className={buttonClasses("outline", "sm")}>
                            DOCX
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="no-print border-t border-sand pt-5">
                <CreateQuoteButton bookingId={booking.id} />
              </div>
            </DetailCard>
          )}

          <DetailCard eyebrow="Registro" title="Modifiche">
            <BookingChangesTimeline changes={changes} lookup={lookup} />
          </DetailCard>
        </div>
      </div>
    </div>
  );
}
