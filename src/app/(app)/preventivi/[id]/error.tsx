"use client";

import { ErrorState } from "@/components/ui";

export default function QuoteError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile caricare il preventivo"
      message="Controlla la connessione e riprova. Se il problema persiste, contatta l’amministratore."
      reset={reset}
    />
  );
}
