import Image from "next/image";
import { format, isValid, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CourseList } from "@/components/bookings/MenuPreview";
import { bookingTitle, formatCovers, formatTime } from "@/components/bookings/format";
import { formatEUR, round2 } from "@/lib/quote-utils";
import {
  SETUP_COLOR_HEX,
  type BookingDetail,
  type QuoteLine,
  type QuoteTotals,
} from "@/lib/types";

export interface QuotePreviewProps {
  number: string;
  issuedAt: string;
  validUntil: string | null;
  booking: BookingDetail;
  lines: QuoteLine[];
  totals: QuoteTotals;
  vatRate: number;
  notes: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const date = parseISO(iso);
  return isValid(date) ? format(date, "d MMMM yyyy", { locale: it }) : "—";
}

/** Anteprima del template di stampa: logo in alto a destra, dati del Casale, cliente, evento, righe, totali. */
export function QuotePreview({ number, issuedAt, validUntil, booking, lines, totals, vatRate, notes }: QuotePreviewProps) {
  const client = booking.client;
  const eventDate = parseISO(booking.event_date);
  const time = formatTime(booking.event_time);

  return (
    <article
      aria-label="Anteprima preventivo"
      className="mx-auto flex w-full min-w-0 max-w-[640px] flex-col gap-7 bg-white p-5 text-ink shadow-lg shadow-ink/10 ring-1 ring-sand sm:p-10 print:max-w-none print:shadow-none print:ring-0"
    >
      <header className="flex flex-col items-start justify-between gap-6 border-b border-sand pb-6 sm:flex-row">
        <div className="flex min-w-0 flex-col gap-1 break-words text-[12px] leading-relaxed text-slate-dark">
          <p className="font-serif text-xl text-ink">Il Casale del Notaio</p>
          <p>Via Nicolosi 67 · 95032 Belpasso (CT)</p>
          <p>Sicilia · +39 340 109 0100</p>
          <p>info@casaledelnotaio.it</p>
        </div>
        <Image src="/logo-dark.svg" alt="Il Casale del Notaio" width={180} height={60} unoptimized className="h-auto w-36 shrink-0 sm:w-44" />
      </header>

      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Preventivo</p>
        <h2 className="font-serif text-3xl">n. {number}</h2>
        <p className="text-[13px] text-slate-dark">
          Emesso il {fmtDate(issuedAt)}
          {validUntil ? ` · Valido fino al ${fmtDate(validUntil)}` : ""}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="flex flex-col gap-1 text-[13px]" aria-label="Cliente">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Cliente</p>
          <p className="font-medium">
            {client.first_name} {client.last_name}
          </p>
          <p>{client.phone}</p>
          {client.tax_code && <p>CF {client.tax_code}</p>}
          {client.vat_number && <p>P.IVA {client.vat_number}</p>}
        </section>

        <section className="flex flex-col gap-1 text-[13px]" aria-label="Evento">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Evento</p>
          <p className="font-medium">{bookingTitle(booking)}</p>
          <p>
            {isValid(eventDate) ? format(eventDate, "EEEE d MMMM yyyy", { locale: it }) : "—"}
            {time ? `, ore ${time}` : ""}
          </p>
          <p>Sala: {booking.room?.name ?? "da assegnare"}</p>
          <p>Coperti: {formatCovers(booking)}{booking.kids_menus > 0 ? ` · Menù bambini ×${booking.kids_menus}` : ""}</p>
        </section>
      </div>

      {(booking.menu || booking.dishes.length > 0) && (
        <section className="flex flex-col gap-2" aria-label="Menù">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
            Menù{booking.menu ? `: ${booking.menu.name}` : ""}
          </p>
          <CourseList items={booking.dishes} className="text-[13px]" />
        </section>
      )}

      {booking.kids_menu && booking.kids_menu.items.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Menù bambini">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
            Menù bambini: {booking.kids_menu.name}
          </p>
          <CourseList items={booking.kids_menu.items} className="text-[13px]" />
        </section>
      )}

      {booking.setup_colors.length > 0 || booking.setup_notes ? (
        <section className="flex flex-col gap-2 text-[13px]" aria-label="Allestimento">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Allestimento</p>
          {booking.setup_colors.length > 0 && (
            <p className="flex flex-wrap items-center gap-2">
              {booking.setup_colors.map((name) => (
                <span key={name} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-full ring-1 ring-ink/25"
                    style={{ backgroundColor: SETUP_COLOR_HEX[name as keyof typeof SETUP_COLOR_HEX] ?? "#B0B0B0" }}
                  />
                  {name}
                </span>
              ))}
            </p>
          )}
          {booking.setup_notes && <p className="whitespace-pre-line">{booking.setup_notes}</p>}
        </section>
      ) : null}

      <section aria-label="Righe del preventivo" className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-0 border-collapse text-[13px] sm:min-w-[420px]">
          <caption className="sr-only">Righe del preventivo</caption>
          <thead>
            <tr className="border-b border-ink text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-dark">
              <th scope="col" className="py-2 pr-3 font-medium">Descrizione</th>
              <th scope="col" className="py-2 px-3 text-right font-medium">Q.tà</th>
              <th scope="col" className="py-2 px-3 text-right font-medium">Prezzo unit.</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Importo</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate">Nessuna riga</td>
              </tr>
            )}
            {lines.map((line, index) => (
              <tr key={index} className="border-b border-sand align-top">
                <td className="py-2 pr-3">{line.description || "—"}</td>
                <td className="py-2 px-3 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 px-3 text-right tabular-nums">{formatEUR(line.unit_price)}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{formatEUR(round2(line.quantity * line.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ml-auto flex w-full max-w-xs flex-col gap-1.5 text-[13px]" aria-label="Totali">
        <div className="flex justify-between">
          <span>Subtotale</span>
          <span className="tabular-nums">{formatEUR(totals.subtotal)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <span>Sconto</span>
            <span className="tabular-nums">− {formatEUR(totals.discount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-ink pt-2 text-[15px] font-semibold">
          <span>Totale (IVA inclusa)</span>
          <span className="tabular-nums">{formatEUR(totals.total)}</span>
        </div>
        <div className="flex justify-between text-slate-dark">
          <span>di cui imponibile</span>
          <span className="tabular-nums">{formatEUR(totals.taxable)}</span>
        </div>
        <div className="flex justify-between text-slate-dark">
          <span>IVA {vatRate}%</span>
          <span className="tabular-nums">{formatEUR(totals.vat)}</span>
        </div>
      </section>

      {notes && (
        <section className="flex flex-col gap-1 text-[13px]" aria-label="Note">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Note</p>
          <p className="whitespace-pre-line">{notes}</p>
        </section>
      )}

      <footer className="mt-4 grid gap-8 border-t border-sand pt-6 text-[12px] text-slate-dark sm:grid-cols-2">
        <div className="flex flex-col gap-10">
          <p>Per il Casale del Notaio</p>
          <p className="border-t border-slate/50 pt-1">Firma</p>
        </div>
        <div className="flex flex-col gap-10">
          <p>Per accettazione</p>
          <p className="border-t border-slate/50 pt-1">Firma del cliente</p>
        </div>
      </footer>
    </article>
  );
}
