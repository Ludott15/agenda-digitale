import { Plus } from "lucide-react";
import Link from "next/link";
import { BookingCard } from "@/components/bookings/BookingCard";
import { EmptyState, StatusLegend } from "@/components/ui";
import type { BookingListItem } from "@/lib/types";
import { MobileCalendar } from "./MobileCalendar";
import { SwipeDay } from "./SwipeDay";
import { capitalize, formatIt, shiftPeriod, toDate } from "./agenda-utils";

export interface MobileAgendaProps {
  selected: string;
  today: string;
  byDate: Map<string, BookingListItem[]>;
  isAdmin: boolean;
  onNavigate: (iso: string) => void;
}

/** Agenda mobile (< lg): calendario mensile in alto, lista eventi del giorno sotto, FAB per admin. */
export function MobileAgenda({ selected, today, byDate, isAdmin, onNavigate }: MobileAgendaProps) {
  const selectedDate = toDate(selected);
  const items = byDate.get(selected) ?? [];
  const dayLabel = capitalize(formatIt(selectedDate, "EEEE d MMMM"));

  return (
    <div className="flex flex-col gap-6">
      <StatusLegend />
      <MobileCalendar selected={selected} today={today} byDate={byDate} onNavigate={onNavigate} />

      <section aria-labelledby="giorno-titolo" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 border-b border-sand pb-3">
          <div className="flex min-w-0 flex-col gap-1">
            {selected === today && (
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-petrol">Oggi</p>
            )}
            <h2 id="giorno-titolo" className="text-2xl">
              {dayLabel}
            </h2>
          </div>
          <span className="shrink-0 text-[13px] text-slate-dark tabular-nums">
            {items.length === 0 ? "Nessun evento" : `${items.length} ${items.length === 1 ? "banchetto" : "banchetti"}`}
          </span>
        </div>

        <SwipeDay
          onPrev={() => onNavigate(shiftPeriod(selected, "day", -1))}
          onNext={() => onNavigate(shiftPeriod(selected, "day", 1))}
        >
          {items.length === 0 ? (
            <EmptyState
              title="Nessun banchetto"
              description={
                isAdmin
                  ? "Questa giornata è libera. Puoi aggiungere una nuova prenotazione."
                  : "Questa giornata è libera."
              }
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
