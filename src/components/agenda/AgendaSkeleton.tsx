import { Skeleton } from "@/components/ui";

/** Stato di caricamento dell'agenda (desktop e mobile). */
export function AgendaSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Caricamento agenda in corso</span>

      <div className="hidden flex-col gap-4 border-b border-sand pb-5 lg:flex">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="hidden grid-cols-7 gap-px lg:grid">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-none" />
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:hidden">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
