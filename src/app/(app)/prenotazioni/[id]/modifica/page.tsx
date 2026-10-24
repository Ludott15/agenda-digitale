import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/bookings/BookingForm";
import { occupancyWindow } from "@/components/bookings/booking-window";
import { bookingTitle } from "@/components/bookings/format";
import { ButtonLink, PageHeader } from "@/components/ui";
import { isUuid } from "@/lib/action-utils";
import { requireAdmin } from "@/lib/auth";
import { getBooking, getRoomBookingSlots } from "@/lib/data/bookings";
import { getMenus, getRooms } from "@/lib/data/catalog";
import { getClientOptions } from "@/lib/data/clients";

export const metadata: Metadata = {
  title: "Modifica prenotazione · Casale del Notaio",
};

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const booking = await getBooking(id);
  if (!booking) notFound();

  const range = occupancyWindow(booking.event_date);
  const [clients, rooms, menus, occupancy] = await Promise.all([
    getClientOptions(),
    getRooms({ includeInactive: true }),
    getMenus({ includeInactive: true }),
    getRoomBookingSlots(range.from, range.to),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Modifica prenotazione"
        title={bookingTitle(booking)}
        description="Modifica i dati della prenotazione. Le variazioni vengono registrate nel registro modifiche."
        actions={
          <ButtonLink href={`/prenotazioni/${booking.id}`} variant="ghost" size="md">
            Torna al dettaglio
          </ButtonLink>
        }
      />
      <BookingForm
        mode="edit"
        booking={booking}
        clients={clients}
        rooms={rooms}
        menus={menus}
        occupancy={occupancy}
        initialDate={booking.event_date}
      />
    </div>
  );
}
