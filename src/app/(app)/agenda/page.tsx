import type { Metadata } from "next";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  max,
  min,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { requireProfile } from "@/lib/auth";
import { getBookingsInRange } from "@/lib/data/bookings";
import { isAdmin } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";
import { AgendaToolbar } from "@/components/agenda/AgendaToolbar";
import { MonthView } from "@/components/agenda/MonthView";
import { DayView, WeekView } from "@/components/agenda/PeriodViews";
import { MobileAgenda } from "@/components/agenda/MobileAgenda";
import {
  capitalize,
  formatIt,
  groupByDate,
  parseDateParam,
  parseView,
  toDate,
  toISO,
  todayISO,
  type AgendaView,
} from "@/components/agenda/agenda-utils";

export const metadata: Metadata = {
  title: "Agenda · Casale del Notaio",
};

type SearchParams = Promise<{ date?: string; view?: string }>;

interface Period {
  from: Date;
  to: Date;
  title: string;
}

function desktopPeriod(view: AgendaView, selected: Date): Period {
  if (view === "week") {
    const from = startOfWeek(selected, { weekStartsOn: 1 });
    const to = endOfWeek(selected, { weekStartsOn: 1 });
    return {
      from,
      to,
      title: `${formatIt(from, "d MMM")} – ${formatIt(to, "d MMM yyyy")}`,
    };
  }
  if (view === "day") {
    return {
      from: selected,
      to: selected,
      title: capitalize(formatIt(selected, "EEEE d MMMM yyyy")),
    };
  }
  return {
    from: startOfWeek(startOfMonth(selected), { weekStartsOn: 1 }),
    to: endOfWeek(endOfMonth(selected), { weekStartsOn: 1 }),
    title: capitalize(formatIt(selected, "LLLL yyyy")),
  };
}

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const profile = await requireProfile();
  const admin = isAdmin(profile);

  const view = parseView(params.view);
  const selected = parseDateParam(params.date);
  const selectedDate = toDate(selected);
  const today = todayISO();

  const desktop = desktopPeriod(view, selectedDate);
  // La vista mobile usa la settimana della data selezionata: si carica l'unione dei due intervalli.
  const weekFrom = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekTo = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const from = min([desktop.from, weekFrom]);
  const to = max([desktop.to, weekTo]);

  const bookings = await getBookingsInRange(toISO(from), toISO(to));
  const byDate = groupByDate(bookings);

  const visibleCount = bookings.filter(
    (b) => b.event_date >= toISO(desktop.from) && b.event_date <= toISO(desktop.to),
  ).length;

  return (
    <>
      <div className="hidden lg:block">
        <AgendaToolbar
          view={view}
          selected={selected}
          today={today}
          title={desktop.title}
          isAdmin={admin}
        />

        {visibleCount === 0 && (
          <div className="mb-6">
            <EmptyState
              title="Nessun banchetto in questo periodo"
              description="Non ci sono prenotazioni attive nel periodo selezionato."
            />
          </div>
        )}

        {view === "month" && (
          <MonthView
            monthDate={selectedDate}
            gridFrom={desktop.from}
            gridTo={desktop.to}
            today={today}
            byDate={byDate}
          />
        )}
        {view === "week" && (
          <WeekView
            days={eachDayOfInterval({ start: weekFrom, end: weekTo })}
            today={today}
            byDate={byDate}
          />
        )}
        {view === "day" && <DayView items={byDate.get(selected) ?? []} />}
      </div>

      <div className="lg:hidden">
        <MobileAgenda selected={selected} today={today} byDate={byDate} isAdmin={admin} />
      </div>
    </>
  );
}
