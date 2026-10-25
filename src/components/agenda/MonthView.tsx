import Link from "next/link";
import { format, isSameMonth } from "date-fns";
import type { BookingListItem } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/types";
import { bookingTitle, formatCovers, formatTime } from "@/components/bookings/format";
import { StatusDot, cn } from "@/components/ui";
import { formatIt, toISO } from "./agenda-utils";

/** Pill visibili per cella: oltre, "+N altri" apre il giorno. Altezza cella fissa = 10rem. */
const MAX_PILLS = 2;

export interface MonthViewProps {
  /** Mese visualizzato (qualsiasi giorno del mese). */
  monthDate: Date;
  /** Giorni della griglia lun-dom (multiplo di 7). */
  days: Date[];
  today: string;
  byDate: Map<string, BookingListItem[]>;
  isAdmin: boolean;
  onOpenDay: (iso: string) => void;
}

/** Evento compatto: ORA + NOME MENÙ (dato principale), sotto sala e coperti. */
function MonthPill({ booking: b }: { booking: BookingListItem }) {
  const time = formatTime(b.event_time);
  const menuName = b.menu?.name ?? null;
  return (
    <Link
      href={`/prenotazioni/${b.id}`}
      title={`${menuName ?? "Menù da definire"} · ${bookingTitle(b)} · ${STATUS_LABELS[b.status]}`}
      style={{ borderLeftColor: STATUS_COLORS[b.status] }}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 border-l-[3px] bg-cream/70 px-2 py-1 transition-colors duration-200 hover:bg-sand/60",
        b.status === "annullato" && "opacity-70",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <StatusDot status={b.status} size="sm" />
        {time && <span className="shrink-0 text-[11px] font-medium tabular-nums text-ink">{time}</span>}
        <span
          className={cn(
            "min-w-0 truncate font-serif text-[13px] leading-tight",
            menuName ? "text-petrol" : "italic text-slate-dark",
          )}
        >
          {menuName ?? "Menù da definire"}
        </span>
      </span>
      <span className="truncate text-[11px] text-slate-dark">
        {b.room?.name ?? "Sala da assegnare"} · {formatCovers(b)}
      </span>
    </Link>
  );
}

/** Griglia mensile lun-dom, desktop. Celle di altezza uniforme; click su un giorno apre la vista giorno. */
export function MonthView({ monthDate, days, today, byDate, isAdmin, onOpenDay }: MonthViewProps) {
  const weekdayLabels = days.slice(0, 7).map((day) => formatIt(day, "EEE"));

  return (
    <section aria-label="Calendario mensile" className="pb-4">
      <div className="grid grid-cols-7 border-l border-t border-sand">
        {weekdayLabels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="border-b border-r border-sand bg-cream px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-bronze"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const iso = toISO(day);
          const items = byDate.get(iso) ?? [];
          const inMonth = isSameMonth(day, monthDate);
          const isToday = iso === today;
          const label = formatIt(day, "EEEE d MMMM");

          const cellClass = cn(
            "flex h-[10rem] min-w-0 flex-col gap-1.5 overflow-hidden border-b border-r border-sand p-1.5 text-left transition-colors duration-200",
            inMonth ? "bg-paper" : "bg-cream/60",
          );
          const dayNumber = (
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-[2px] text-[13px] tabular-nums",
                isToday ? "bg-petrol font-medium text-paper" : inMonth ? "text-ink" : "text-slate",
              )}
            >
              {format(day, "d")}
            </span>
          );

          if (items.length === 0) {
            if (isAdmin) {
              return (
                <Link
                  key={iso}
                  href={`/prenotazioni/nuova?date=${iso}`}
                  aria-label={`Nuova prenotazione, ${label}`}
                  className={cn(cellClass, "hover:bg-cream/70")}
                >
                  {dayNumber}
                </Link>
              );
            }
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onOpenDay(iso)}
                aria-label={`Apri ${label}`}
                className={cn(cellClass, "hover:bg-cream/70")}
              >
                {dayNumber}
              </button>
            );
          }

          const shown = items.slice(0, MAX_PILLS);
          const hidden = items.length - shown.length;

          return (
            <div key={iso} className={cellClass}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDay(iso)}
                  aria-label={`Apri ${label}, ${items.length} ${items.length === 1 ? "banchetto" : "banchetti"}`}
                  className="rounded-[2px] transition-colors hover:bg-cream"
                >
                  {dayNumber}
                </button>
                <span className="text-[11px] tabular-nums text-slate-dark">{items.length}</span>
              </div>

              {shown.map((booking) => (
                <MonthPill key={booking.id} booking={booking} />
              ))}

              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenDay(iso)}
                  className="text-left text-[12px] font-medium text-petrol underline-offset-2 hover:underline"
                >
                  +{hidden} altri
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
