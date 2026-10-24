"use client";

import { ErrorState } from "@/components/ui";

export default function ClientsError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile caricare i clienti"
      message="Non è stato possibile recuperare l'anagrafica. Riprova tra poco."
      reset={reset}
    />
  );
}
