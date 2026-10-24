import { ChevronDown, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatIt, toDate } from "@/components/agenda/agenda-utils";
import { Badge } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import {
  SETUP_COLORS,
  SETUP_COLOR_HEX,
  STATUS_LABELS,
  type BookingListItem,
  type BookingStatus,
} from "@/lib/types";
import {
  bookingTitle,
  clientFullName,
  formatCovers,
  formatTime,
  groupDishes,
  totalCovers,
  type DishGroup,
} from "./format";

export interface BookingCardProps {
  booking: BookingListItem;
  /** compact: cella del calendario mese / lista dashboard. full: card ricca. */
  variant?: "compact" | "full";
  /** Come mostrare il menù (piatti) nella variante full. */
  dishes?: "inline" | "collapsible" | "hidden";
  showDate?: boolean;
  className?: string;
}

const STATUS_BORDER_LEFT: Record<BookingStatus, string> = {
  opzione: "border-l-warning",
  confermato: "border-l-petrol",
  annullato: "border-l-disabled",
};

const STATUS_BORDER_TOP: Record<BookingStatus, string> = {
  opzione: "border-t-warning",
  confermato: "border-t-petrol",
  annullato: "border-t-disabled",
};

const STATUS_DOT: Record<BookingStatus, string> = {
  opzione: "bg-warning",
  confermato: "bg-success",
  annullato: "bg-disabled",
};

const SETUP_FALLBACK = "#B0B0B0";

/** Menù scelto: etichetta serif in pill petrol, la prima informazione della card. */
function MenuLabel({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span className="inline-flex max-w-full items-center rounded-[2px] border border-dashed border-slate/60 px-3 py-1.5 font-serif text-[15px] italic text-slate-dark">
        Menù da definire
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center rounded-[2px] bg-petrol px-3 py-1.5 font-serif text-[15px] leading-tight text-paper break-words">
      {name}
    </span>
  );
}

/** Stato come indicatore secondario: pallino colorato + testo minuto. */
function StatusIndicator({ status }: { status: BookingStatus }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-slate-dark">
      <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[status])} />
      <span>
        <span className="sr-only">Stato: </span>
        {STATUS_LABELS[status]}
      </span>
    </span>
  );
}

/** Colori di allestimento: pallini distanziati e nomi che vanno a capo, senza troncamenti. */
function SetupColors({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-slate-dark">
      <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
        {colors.map((name) => (
          <span
            key={name}
            title={name}
            className="size-3.5 rounded-full ring-1 ring-ink/25"
            style={{ backgroundColor: SETUP_COLOR_HEX[name as (typeof SETUP_COLORS)[number]] ?? SETUP_FALLBACK }}
          />
        ))}
      </span>
      <span className="min-w-0 break-words">{colors.join(" · ")}</span>
    </div>
  );
}

export function BookingCard({
  booking: b,
  variant = "compact",
  dishes = "inline",
  showDate = false,
  className,
}: BookingCardProps) {
  const href = `/prenotazioni/${b.id}`;
  const time = formatTime(b.event_time);
  const dateLabel = showDate ? formatIt(toDate(b.event_date), "EEE d MMM") : null;
  const allergyCount = b.allergies.length;
  const title = bookingTitle(b);
  const menuName = b.menu?.name ?? null;

  if (variant === "compact") {
    return (
      <Link
        href={href}
        aria-label={`${menuName ?? "Menù da definire"}, ${title}${time ? `, ore ${time}` : ""}${b.room ? `, ${b.room.name}` : ""}, ${formatCovers(b)} coperti${allergyCount > 0 ? `, ${allergyCount} allergie` : ""}`}
        className={cn(
          "flex flex-col gap-1.5 border-l-[3px] bg-cream/70 px-3 py-3 text-ink transition-colors duration-200 hover:bg-sand/60",
          STATUS_BORDER_LEFT[b.status],
          b.status === "annullato" && "line-through opacity-70",
          className,
        )}
      >
        <span className="flex items-center gap-2 text-[12px] text-slate-dark">
          {dateLabel && <span className="font-medium">{dateLabel}</span>}
          {time && <span className="font-medium tabular-nums text-ink">{time}</span>}
          {allergyCount > 0 && (
            <span
              className="ml-auto inline-flex shrink-0 items-center gap-1 text-danger"
              title={`${allergyCount} ${allergyCount === 1 ? "allergia" : "allergie"}`}
            >
              <TriangleAlert aria-hidden="true" className="size-3.5" />
              <span className="text-[12px] tabular-nums">{allergyCount}</span>
              <span className="sr-only">{allergyCount} allergie</span>
            </span>
          )}
        </span>
        <span className="font-serif text-[16px] font-semibold leading-snug text-petrol break-words">
          {menuName ?? "Menù da definire"}
        </span>
        <span className="line-clamp-2 break-words text-[13px] leading-snug">{title}</span>
        <span className="truncate text-[12px] text-slate-dark">
          {b.room?.name ?? "Sala da assegnare"} · {formatCovers(b)}
        </span>
      </Link>
    );
  }

  const groups = groupDishes(b.dishes);
  const hasDishes = dishes !== "hidden" && groups.length > 0;

  return (
    <article
      className={cn(
        "flex flex-col gap-5 rounded-[2px] border border-sand border-t-[3px] bg-paper p-5 shadow-sm shadow-ink/5 sm:p-6",
        STATUS_BORDER_TOP[b.status],
        className,
      )}
    >
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <MenuLabel name={menuName} />
          <StatusIndicator status={b.status} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
            {dateLabel && <span>{dateLabel}</span>}
            {time && <span>ore {time}</span>}
            {b.room && <span>{b.room.name}</span>}
          </p>
          <h3 className="font-serif text-xl leading-tight break-words">
            <Link
              href={href}
              className="rounded-[2px] underline-offset-4 hover:text-petrol hover:underline"
            >
              {title}
            </Link>
          </h3>
          {b.event_name && (
            <p className="break-words text-[14px] text-slate-dark">
              {clientFullName(b)} · {b.client.phone}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <p className="flex items-baseline gap-2" title="A = adulti, B = bambini">
            <span className="font-serif text-4xl leading-none tabular-nums text-ink">{totalCovers(b)}</span>
            <span className="text-[13px] text-slate-dark">
              coperti <span className="tabular-nums text-slate">({formatCovers(b)})</span>
            </span>
          </p>
          {b.kids_menus > 0 && <Badge tone="petrol">Menù bambini ×{b.kids_menus}</Badge>}
          {allergyCount > 0 && (
            <Badge tone="danger">
              <TriangleAlert aria-hidden="true" className="size-3" />
              {allergyCount} {allergyCount === 1 ? "allergia" : "allergie"}
            </Badge>
          )}
        </div>
      </header>

      <SetupColors colors={b.setup_colors} />

      {hasDishes &&
        (dishes === "collapsible" ? (
          <details className="group border-t border-sand pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-[2px] text-[13px] font-medium text-petrol transition-colors hover:text-petrol-hover">
              Piatti del menù ({b.dishes.length})
              <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="mt-4">
              <DishList groups={groups} />
            </div>
          </details>
        ) : (
          <div className="border-t border-sand pt-4">
            <DishList groups={groups} />
          </div>
        ))}

      {allergyCount > 0 && (
        <div className="border-l-[3px] border-danger bg-danger/5 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-danger">
            Allergie e patologie
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[14px] text-ink">
            {b.allergies.map((allergy) => (
              <li key={allergy.id} className="break-words">
                {allergy.condition}
                {allergy.subject_name && (
                  <span className="text-slate-dark"> ({allergy.subject_name})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function DishList({ groups }: { groups: DishGroup[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.course}>
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
            {group.label}
          </dt>
          <dd>
            <ul className="mt-0.5 text-[14px] leading-snug text-ink">
              {group.items.map((dish) => (
                <li key={dish.id}>{dish.name}</li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}
