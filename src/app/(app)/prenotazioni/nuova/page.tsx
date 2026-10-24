import type { Metadata } from "next";
import { parseDateParam } from "@/components/agenda/agenda-utils";
import { BookingForm } from "@/components/bookings/BookingForm";
import { occupancyWindow } from "@/components/bookings/booking-window";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getMenus, getRooms } from "@/lib/data/catalog";
import { getRoomBookingSlots } from "@/lib/data/bookings";
import { getClientOptions } from "@/lib/data/clients";

export const metadata: Metadata = {
  title: "Nuova prenotazione · Casale del Notaio",
};

type SearchParams = Promise<{ date?: string; client?: string }>;

export default async function NewBookingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const date = parseDateParam(params.date);
  const range = occupancyWindow();

  const [clients, rooms, menus, occupancy] = await Promise.all([
    getClientOptions(),
    getRooms({ includeInactive: true }),
    getMenus({ includeInactive: true }),
    getRoomBookingSlots(range.from, range.to),
  ]);

  const initialClientId = params.client && clients.some((c) => c.id === params.client) ? params.client : undefined;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Nuova prenotazione"
        title="Nuovo banchetto"
        description="Cliente, evento, coperti, sala, allestimento, menù e allergie. I campi con asterisco sono obbligatori."
        actions={
          <ButtonLink href={`/agenda?date=${date}&view=day`} variant="ghost" size="md">
            Torna all’agenda
          </ButtonLink>
        }
      />
      <BookingForm
        mode="create"
        clients={clients}
        rooms={rooms}
        menus={menus}
        occupancy={occupancy}
        initialDate={date}
        initialClientId={initialClientId}
      />
    </div>
  );
}
