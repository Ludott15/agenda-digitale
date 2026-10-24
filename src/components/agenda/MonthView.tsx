import Link from "next/link";
import { BookingCard } from "@/components/bookings/BookingCard";
import type { BookingListItem } from "@/lib/types";
import { agendaHref, formatIt, toISO } from "./agenda-utils";
import { eachDayOfInterval, format, isSameMonth } from "date-fns";

const MAX_PER_CELL = 3;

export interface MonthViewProps {
  monthDate: Date;
  gridFrom: Date;
  gridTo: Date;
  today: string;
  byDate: Map<string, BookingListItem[]>;
}

/** Griglia mensile lun-dom, desktop. */
export function MonthView({ monthDate, gridFrom, gridTo, today, byDate }: MonthViewProps) {
  const days = eachDayOfInterval({ start: gridFrom, end: gridTo });
  const weekdayLabels = days.slice(0, 7).map((day) => formatIt(day, "EEE"));

  return (
    <section aria-label="Calendario mensile">
      <div className="grid grid-cols-7 border-l border-t border-sand">
        {weekdayLabels.map((label) => (
          <div
            key={label}
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
          const visible = items.slice(0, MAX_PER_CELL);
          const hidden = items.length - visible.length;

          return (
            <div
              key={iso}
              className={`flex min-h-36 min-w-0 flex-col gap-1.5 border-b border-r border-sand p-1.5 ${inMonth ? "bg-paper" : "bg-cream/60"}`}
            >
              <div className="flex items-center justify-between">
                <Link
                  href={agendaHref({ date: iso, view: "day" })}
                  aria-label={`${formatIt(day, "EEEE d MMMM")}, ${items.length} banchetti`}
                  className={`grid size-7 place-items-center rounded-[2px] text-[13px] tabular-nums transition-colors hover:bg-cream ${
                    isToday
                      ? "bg-petrol font-medium text-paper hover:bg-petrol-hover"
                      : inMonth
                        ? "text-ink"
                        : "text-slate"
                  }`}
                >
                  {format(day, "d")}
                </Link>
                {items.length > 0 && (
                  <span className="text-[11px] tabular-nums text-slate-dark">{items.length}</span>
                )}
              </div>

              {visible.map((booking) => (
                <BookingCard key={booking.id} booking={booking} variant="compact" />
              ))}

              {hidden > 0 && (
                <Link
                  href={agendaHref({ date: iso, view: "day" })}
                  className="text-[12px] font-medium text-petrol underline-offset-2 hover:underline"
                >
                  +{hidden} altri
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
