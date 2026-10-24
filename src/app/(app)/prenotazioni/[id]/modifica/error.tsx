"use client";

import { ErrorState } from "@/components/ui";

export default function EditBookingError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile caricare la prenotazione"
      message="Controlla la connessione e riprova. Se il problema persiste, contatta l’amministratore."
      reset={reset}
    />
  );
}
