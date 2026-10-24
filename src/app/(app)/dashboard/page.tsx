import type { Metadata } from "next";
import Link from "next/link";
import { addDays, endOfWeek, startOfWeek } from "date-fns";
import { formatIt, toDate, toISO, todayISO, capitalize } from "@/components/agenda/agenda-utils";
import { BookingCard } from "@/components/bookings/BookingCard";
import { formatChangeTimestamp } from "@/components/bookings/change-labels";
import { RoomOccupancyMatrix } from "@/components/dashboard/RoomOccupancyMatrix";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
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

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  highlight?: boolean;
}

function StatTile({ label, value, hint, highlight = false }: StatTileProps) {
  return (
    <Card className={`flex flex-col gap-3 p-5 ${highlight ? "border-warning/60 bg-warning/10" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">{label}</p>
      <p className="font-serif text-4xl tabular-nums text-ink lg:text-5xl">{value}</p>
      <p className="text-[13px] text-slate-dark">{hint}</p>
    </Card>
  );
}

export default async function DashboardPage() {
  await requireAdmin();

  const today = todayISO();
  const todayDate = toDate(today);
  const weekStart = startOfWeek(todayDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(todayDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)));

  const [stats, upcoming, rooms, weekBookings, deletions] = await Promise.all([
    getDashboardStats(),
    getUpcomingBookings(8),
    getRooms(),
    getBookingsInRange(toISO(weekStart), toISO(weekEnd)),
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

  return (
    <div className="flex flex-col gap-10">
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

      <section aria-label="Indicatori principali" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </section>

      <section aria-labelledby="prossimi-eventi" className="flex flex-col gap-5">
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
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {upcoming.map((booking) => (
              <li key={booking.id}>
                <BookingCard booking={booking} variant="compact" showDate className="h-full" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sale-settimana" className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 border-b border-sand pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Settimana corrente</p>
            <h2 id="sale-settimana" className="text-2xl">
              Sale questa settimana
            </h2>
          </div>
          <p className="text-[13px] text-slate-dark">
            {formatIt(weekStart, "d MMMM")} – {formatIt(weekEnd, "d MMMM yyyy")}
          </p>
        </div>

        <RoomOccupancyMatrix
          rooms={rooms.filter((room) => room.active)}
          days={weekDays}
          bookings={weekBookings}
        />

        <p className="text-[13px] text-slate-dark">
          Le celle piene indicano una sala occupata: coperti sulla capienza. Clicca per aprire la prenotazione.{" "}
          <Link href="/catalogo" className="font-medium text-petrol underline-offset-2 hover:underline">
            Gestisci sale e menù
          </Link>
        </p>
      </section>

      <section aria-labelledby="eliminazioni-recenti" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 border-b border-sand pb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">Registro</p>
          <h2 id="eliminazioni-recenti" className="text-xl">
            Eliminazioni recenti
          </h2>
        </div>

        {deletions.length === 0 ? (
          <p className="text-[13px] text-slate-dark">Nessuna prenotazione eliminata.</p>
        ) : (
          <Card className="divide-y divide-sand">
            <ul>
              {deletions.map((change) => (
                <li
                  key={change.id}
                  className="flex flex-col gap-1 px-5 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="text-ink">{change.booking_label ?? change.old_value ?? "Prenotazione"}</span>
                  <span className="text-slate-dark">
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
