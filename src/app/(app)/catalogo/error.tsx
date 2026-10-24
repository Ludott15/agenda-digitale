"use client";

import { ErrorState } from "@/components/ui";

export default function CatalogError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile caricare il catalogo"
      message="Non è stato possibile recuperare menù e sale. Riprova tra poco."
      reset={reset}
    />
  );
}
