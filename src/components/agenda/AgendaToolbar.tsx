import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ButtonLink, buttonClasses, cn } from "@/components/ui";
import { agendaHref, shiftPeriod, type AgendaView } from "./agenda-utils";

const VIEWS: Array<{ value: AgendaView; label: string }> = [
  { value: "month", label: "Mese" },
  { value: "week", label: "Settimana" },
  { value: "day", label: "Giorno" },
];

export interface AgendaToolbarProps {
  view: AgendaView;
  selected: string;
  today: string;
  title: string;
  isAdmin: boolean;
}

/** Toolbar desktop: navigazione periodo, titolo, switch vista, nuova prenotazione. */
export function AgendaToolbar({ view, selected, today, title, isAdmin }: AgendaToolbarProps) {
  const prev = shiftPeriod(selected, view, -1);
  const next = shiftPeriod(selected, view, 1);
  const navButton =
    "grid size-10 place-items-center rounded-btn text-petrol transition-colors duration-200 hover:bg-cream";

  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-sand pb-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={agendaHref({ date: today, view })} className={buttonClasses("outline", "sm")}>
          Oggi
        </Link>
        <div className="flex items-center">
          <Link href={agendaHref({ date: prev, view })} aria-label="Periodo precedente" className={navButton}>
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <Link href={agendaHref({ date: next, view })} aria-label="Periodo successivo" className={navButton}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <h1 className="text-2xl capitalize lg:text-3xl">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Vista calendario" className="inline-flex border border-petrol">
          {VIEWS.map((item) => {
            const active = item.value === view;
            return (
              <Link
                key={item.value}
                href={agendaHref({ date: selected, view: item.value })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-4 py-2 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors duration-200",
                  active ? "bg-petrol text-paper" : "text-petrol hover:bg-cream",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isAdmin && (
          <ButtonLink href={`/prenotazioni/nuova?date=${selected}`} variant="primary" size="md">
            <CalendarPlus aria-hidden="true" className="size-4" />
            Nuova prenotazione
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
