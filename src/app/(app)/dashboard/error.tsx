"use client";

import { ErrorState } from "@/components/ui";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Impossibile caricare la dashboard"
      message="Non è stato possibile recuperare gli indicatori. Riprova tra poco."
      reset={reset}
    />
  );
}
