"use client";

import { ErrorState } from "@/components/ui";

export default function AgendaError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile caricare l'agenda"
      message="Controlla la connessione e riprova. Se il problema persiste, contatta l'amministratore."
      reset={reset}
    />
  );
}
