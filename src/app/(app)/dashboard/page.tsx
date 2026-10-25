import type { Metadata } from "next";
import Link from "next/link";
import { addDays, endOfWeek } from "date-fns";
import { formatIt, toDate, toISO, todayISO, capitalize } from "@/components/agenda/agenda-utils";
import { BookingCard } from "@/components/bookings/BookingCard";
import { formatChangeTimestamp } from "@/components/bookings/change-labels";
import { RoomDayView } from "@/components/dashboard/RoomDayView";
import { RoomOccupancyMatrix } from "@/components/dashboard/RoomOccupancyMatrix";
import { WeekNav } from "@/components/dashboard/WeekNav";
import { resolveWeekStart, weekLabel, weekRange } from "@/components/dashboard/week";
import { ButtonLink, Card, EmptyState, PageHeader, StatusLegend } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import {
  getBookingsInRange,
  getDashboardStats,
  getDeletionLog,
  getUpcomingBookings,
} from "@/lib/data/bookings";
import { getRooms } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Dashboard · Casale del Notaio",
};

type SearchParams = Promise<{ week?: string; day?: string }>;

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  highlight?: boolean;
}

function StatTile({ label, value, hint, highlight = false }: StatTileProps) {
  return (
    <Card
      className={`flex min-w-0 flex-col gap-2 p-4 sm:gap-3 sm:p-5 ${highlight ? "border-warning/60 bg-warning/10" : ""}`}
    >
      <p className="text-[10px] font-medium uppercase leading-snug tracking-[0.12em] text-bronze sm:text-[11px] sm:tracking-[0.14em]">
        {label}
      </p>
      <p className="font-serif text-3xl tabular-nums text-ink sm:text-4xl lg:text-5xl">{value}</p>
      <p className="text-[12px] leading-snug text-slate-dark sm:text-[13px]">{hint}</p>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const today = todayISO();
  const todayDate = toDate(today);
  const currentWeekStart = resolveWeekStart(undefined, today);
  const weekStart = resolveWeekStart(params.week, today);
  const week = weekRange(weekStart);
  const weekIso = week.startIso;
  const weekDays = week.days;
  const selectedDay =
    params.day && weekDays.includes(params.day)
      ? params.day
      : weekDays.includes(today)
        ? today
        : weekDays[0];
  const isCurrentWeek = week.startIso === toISO(currentWeekStart);

  const [stats, upcoming, rooms, weekBookings, deletions] = await Promise.all([
    getDashboardStats(),
    getUpcomingBookings(8),
    getRooms(),
    getBookingsInRange(week.startIso, week.endIso),
    getDeletionLog(5),
  ]);

  const tiles: StatTileProps[] = [
    {
      label: "Eventi oggi",
      value: stats.eventsToday,
      hint: capitalize(formatIt(todayDate, "EEEE d MMMM")),
    },
    {
      label: "Eventi nel mese",
      value: stats.eventsThisMonth,
      hint: capitalize(formatIt(todayDate, "LLLL yyyy")),
    },
    {
      label: "Coperti · 7 giorni",
      value: stats.coversNext7Days,
      hint: "Adulti e bambini nei prossimi sette giorni",
    },
    {
      label: "Opzioni da confermare",
      value: stats.pendingOptions,
      hint: stats.pendingOptions > 0 ? "Richiedono una conferma" : "Nessuna opzione in sospeso",
      highlight: stats.pendingOptions > 0,
    },
  ];

  const activeRooms = rooms.filter((room) => room.active);
  const previousWeekIso = toISO(addDays(week.start, -7));
  const nextWeekIso = toISO(addDays(week.start, 7));

  return (
    <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="Direzione"
        title="Dashboard"
        description={`Panoramica di ${capitalize(formatIt(todayDate, "EEEE d MMMM yyyy"))}.`}
        actions={
          <ButtonLink href={`/agenda?date=${today}&view=month`} variant="outline" size="md">
            Vai all&rsquo;agenda
          </ButtonLink>
        }
      />

      <section aria-label="Indicatori principali" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </section>

      <section aria-labelledby="prossimi-eventi" className="flex min-w-0 flex-col gap-5">
        <div className="flex items-end justify-between gap-4 border-b border-sand pb-3">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">In arrivo</p>
            <h2 id="prossimi-eventi" className="text-2xl">
              Prossimi eventi
            </h2>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            title="Nessun evento in programma"
            description="Quando verranno create nuove prenotazioni compariranno qui."
          />
        ) : (
          <ul className="flex flex-col gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
            {upcoming.map((booking) => (
              <li key={booking.id} className="min-w-0">
                <BookingCard booking={booking} variant="compact" showDate className="h-full" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sale-settimana" className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-4 border-b border-sand pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
              {weekLabel(weekStart, currentWeekStart)}
            </p>
            <h2 id="sale-settimana" className="text-2xl">
              Occupazione sale
            </h2>
            <p className="text-[13px] text-slate-dark">
              {formatIt(week.start, "d MMMM")} – {formatIt(endOfWeek(week.start, { weekStartsOn: 1 }), "d MMMM yyyy")}
            </p>
          </div>
          <WeekNav
            previousHref={`/dashboard?week=${previousWeekIso}`}
            nextHref={`/dashboard?week=${nextWeekIso}`}
            todayHref="/dashboard"
            isCurrentWeek={isCurrentWeek}
          />
        </div>

        <StatusLegend />

        <div className="hidden min-w-0 lg:block">
          <RoomOccupancyMatrix rooms={activeRooms} days={weekDays} bookings={weekBookings} />
        </div>

        <div className="min-w-0 lg:hidden">
          <RoomDayView
            rooms={activeRooms}
            days={weekDays}
            selectedDay={selectedDay}
            todayIso={today}
            bookings={weekBookings}
            dayHref={(iso) => `/dashboard?week=${weekIso}&day=${iso}`}
          />
        </div>

        <p className="text-[13px] text-slate-dark">
          Le sale piene sono occupate: coperti sulla capienza. Tocca o clicca per aprire la prenotazione.{" "}
          <Link href="/catalogo" className="font-medium text-petrol underline-offset-2 hover:underline">
            Gestisci sale e menù
          </Link>
        </p>
      </section>

      <section aria-labelledby="eliminazioni-recenti" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1 border-b border-sand pb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Registro</p>
          <h2 id="eliminazioni-recenti" className="text-xl">
            Eliminazioni recenti
          </h2>
        </div>

        {deletions.length === 0 ? (
          <p className="text-[13px] text-slate-dark">Nessuna prenotazione eliminata.</p>
        ) : (
          <Card className="min-w-0 divide-y divide-sand">
            <ul>
              {deletions.map((change) => (
                <li
                  key={change.id}
                  className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="min-w-0 break-words text-ink">
                    {change.booking_label ?? change.old_value ?? "Prenotazione"}
                  </span>
                  <span className="shrink-0 text-[12px] text-slate-dark">
                    Eliminata da {change.changed_by_name} · {formatChangeTimestamp(change.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
