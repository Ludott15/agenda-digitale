"use client";

import { ErrorState } from "@/components/ui";

export default function OperatorsError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile caricare gli operatori"
      message="Non è stato possibile recuperare l'elenco degli account. Riprova tra poco."
      reset={reset}
    />
  );
}
