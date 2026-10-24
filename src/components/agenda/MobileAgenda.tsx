import { addDays, addWeeks, format, subDays, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { BookingCard } from "@/components/bookings/BookingCard";
import { EmptyState, cn } from "@/components/ui";
import { SwipeDay } from "./SwipeDay";
import type { BookingListItem } from "@/lib/types";
import {
  agendaHref,
  capitalize,
  formatIt,
  toDate,
  toISO,
  weekDates,
} from "./agenda-utils";

export interface MobileAgendaProps {
  selected: string;
  today: string;
  byDate: Map<string, BookingListItem[]>;
  isAdmin: boolean;
}

/** Agenda mobile (< lg): striscia settimanale, lista del giorno, FAB per admin. */
export function MobileAgenda({ selected, today, byDate, isAdmin }: MobileAgendaProps) {
  const selectedDate = toDate(selected);
  const days = weekDates(selected);
  const prevWeek = toISO(subWeeks(selectedDate, 1));
  const nextWeek = toISO(addWeeks(selectedDate, 1));
  const prevDay = toISO(subDays(selectedDate, 1));
  const nextDay = toISO(addDays(selectedDate, 1));
  const items = byDate.get(selected) ?? [];
  const dayLabel = capitalize(formatIt(selectedDate, "EEEE d MMMM"));
  const navButton =
    "grid size-10 place-items-center rounded-btn text-petrol transition-colors hover:bg-cream";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Agenda</p>
          <h1 className="text-3xl capitalize">{formatIt(selectedDate, "LLLL yyyy")}</h1>
        </div>
        <div className="flex items-center">
          <Link href={agendaHref({ date: prevWeek, view: "day" })} aria-label="Settimana precedente" className={navButton}>
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <Link href={agendaHref({ date: nextWeek, view: "day" })} aria-label="Settimana successiva" className={navButton}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </header>

      <nav aria-label="Giorni della settimana">
        <ol className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const iso = toISO(day);
            const count = byDate.get(iso)?.length ?? 0;
            const isSelected = iso === selected;
            const isToday = iso === today;
            return (
              <li key={iso}>
                <Link
                  href={agendaHref({ date: iso, view: "day" })}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={`${formatIt(day, "EEEE d MMMM")}${count > 0 ? `, ${count} banchetti` : ""}`}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-[2px] border py-2.5 transition-colors duration-200",
                    isSelected
                      ? "border-petrol bg-petrol text-paper"
                      : "border-sand bg-paper text-ink hover:border-slate",
                    isToday && !isSelected && "border-petrol/60",
                  )}
                >
                  <span className="text-[10px] font-medium uppercase tracking-[0.06em]">
                    {formatIt(day, "EEE")}
                  </span>
                  <span className="font-serif text-lg leading-none tabular-nums">
                    {format(day, "d")}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 rounded-full",
                      count > 0 ? (isSelected ? "bg-paper" : "bg-bronze") : "bg-transparent",
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="giorno-titolo" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 border-b border-sand pb-3">
          <div className="flex flex-col gap-1">
            {selected === today && (
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-petrol">Oggi</p>
            )}
            <h2 id="giorno-titolo" className="text-2xl">
              {dayLabel}
            </h2>
          </div>
          <span className="text-[13px] text-slate-dark tabular-nums">
            {items.length === 0 ? "Nessun evento" : `${items.length} ${items.length === 1 ? "banchetto" : "banchetti"}`}
          </span>
        </div>

        <SwipeDay
          prevHref={agendaHref({ date: prevDay, view: "day" })}
          nextHref={agendaHref({ date: nextDay, view: "day" })}
        >
          {items.length === 0 ? (
            <EmptyState
              title="Nessun banchetto"
              description="Questa giornata è libera. Puoi aggiungere una nuova prenotazione."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((booking) => (
                <BookingCard key={booking.id} booking={booking} variant="full" dishes="collapsible" />
              ))}
            </div>
          )}
        </SwipeDay>
      </section>

      {isAdmin && (
        <Link
          href={`/prenotazioni/nuova?date=${selected}`}
          aria-label="Nuova prenotazione"
          className="no-print fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 z-40 grid size-14 place-items-center rounded-[2px] bg-petrol text-paper shadow-lg shadow-ink/30 transition-colors hover:bg-petrol-hover"
        >
          <Plus aria-hidden="true" className="size-6" />
        </Link>
      )}
    </div>
  );
}
