import Link from "next/link";
import { formatIt, toDate } from "@/components/agenda/agenda-utils";
import { bookingTitle, totalCovers } from "@/components/bookings/format";
import { EmptyState } from "@/components/ui";
import type { BookingListItem, Room } from "@/lib/types";

export interface RoomOccupancyMatrixProps {
  rooms: Room[];
  days: string[];
  bookings: BookingListItem[];
}

/** Matrice sale x giorni della settimana. Cella piena = sala occupata (coperti / capienza). */
export function RoomOccupancyMatrix({ rooms, days, bookings }: RoomOccupancyMatrixProps) {
  if (rooms.length === 0) {
    return (
      <EmptyState title="Nessuna sala attiva" description="Configura le sale dal catalogo per vedere l'occupazione." />
    );
  }

  const byCell = new Map<string, BookingListItem>();
  for (const booking of bookings) {
    if (booking.room_id) byCell.set(`${booking.room_id}|${booking.event_date}`, booking);
  }

  return (
    <div className="overflow-x-auto rounded-[2px] border border-sand bg-paper">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <caption className="sr-only">Occupazione delle sale nei giorni della settimana</caption>
        <thead>
          <tr className="border-b border-sand bg-cream/60">
            <th scope="col" className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
              Sala
            </th>
            {days.map((iso) => (
              <th
                key={iso}
                scope="col"
                className="px-2 py-3 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-bronze"
              >
                {formatIt(toDate(iso), "EEE d")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className="border-b border-sand last:border-b-0">
              <th scope="row" className="px-4 py-2 text-left align-middle">
                <span className="block font-medium text-ink">{room.name}</span>
                <span className="block text-[12px] text-slate-dark">cap. {room.capacity}</span>
              </th>
              {days.map((iso) => {
                const booking = byCell.get(`${room.id}|${iso}`);
                if (!booking) {
                  return (
                    <td key={iso} className="p-1.5 align-middle">
                      <div className="flex min-h-14 items-center justify-center rounded-[2px] border border-dashed border-sand">
                        <span className="sr-only">Libera</span>
                      </div>
                    </td>
                  );
                }
                const covers = totalCovers(booking);
                return (
                  <td key={iso} className="p-1.5 align-middle">
                    <Link
                      href={`/prenotazioni/${booking.id}`}
                      title={`${bookingTitle(booking)}: ${covers} coperti su capienza ${room.capacity}`}
                      className="flex min-h-14 flex-col justify-center rounded-[2px] bg-petrol px-2.5 py-2 text-paper transition-colors duration-200 hover:bg-petrol-hover"
                    >
                      <span className="text-[12px] font-medium tabular-nums">
                        {covers}/{room.capacity}
                      </span>
                      <span className="truncate text-[11px] text-paper/85">{bookingTitle(booking)}</span>
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
