"use client";

import { ErrorState } from "@/components/ui";

export default function NewBookingError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile aprire il modulo"
      message="Non è stato possibile caricare clienti, sale o menù. Riprova tra poco."
      reset={reset}
    />
  );
}
