"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { cn } from "@/components/ui/cn";

export interface WeekNavProps {
  previousHref: string;
  nextHref: string;
  todayHref: string;
  isCurrentWeek: boolean;
}

/** Indicatore di caricamento dentro il link, mentre la settimana richiesta è in arrivo. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute right-1.5 top-1.5 size-1.5 rounded-full bg-bronze transition-opacity duration-200",
        pending ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

const ICON_LINK =
  "relative inline-flex size-10 items-center justify-center rounded-btn border border-sand bg-paper text-petrol transition-colors duration-200 hover:bg-cream";

/** Navigazione settimana precedente / oggi / successiva, con prefetch e senza salto di scroll. */
export function WeekNav({ previousHref, nextHref, todayHref, isCurrentWeek }: WeekNavProps) {
  return (
    <nav aria-label="Cambia settimana" className="flex items-center gap-2">
      <Link href={previousHref} scroll={false} aria-label="Settimana precedente" className={ICON_LINK}>
        <ChevronLeft aria-hidden="true" className="size-5" />
        <PendingDot />
      </Link>
      <Link
        href={todayHref}
        scroll={false}
        aria-current={isCurrentWeek ? "date" : undefined}
        className={cn(
          "relative inline-flex h-10 items-center rounded-btn border px-4 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors duration-200",
          isCurrentWeek
            ? "border-petrol bg-petrol text-paper hover:bg-petrol-hover"
            : "border-petrol text-petrol hover:bg-petrol hover:text-paper",
        )}
      >
        Oggi
        <PendingDot />
      </Link>
      <Link href={nextHref} scroll={false} aria-label="Settimana successiva" className={ICON_LINK}>
        <ChevronRight aria-hidden="true" className="size-5" />
        <PendingDot />
      </Link>
    </nav>
  );
}
