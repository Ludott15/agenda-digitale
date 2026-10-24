import { ChevronDown, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatIt, toDate } from "@/components/agenda/agenda-utils";
import { Badge, ColorDots, StatusBadge } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type { BookingListItem, BookingStatus } from "@/lib/types";
import {
  bookingTitle,
  clientFullName,
  formatCovers,
  formatTime,
  groupDishes,
  type DishGroup,
} from "./format";

export interface BookingCardProps {
  booking: BookingListItem;
  /** compact: cella del calendario mese / lista dashboard. full: card ricca. */
  variant?: "compact" | "full";
  /** Come mostrare il menù nella variante full. */
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

  if (variant === "compact") {
    return (
      <Link
        href={href}
        aria-label={`${title}${time ? `, ore ${time}` : ""}${b.room ? `, ${b.room.name}` : ""}, ${formatCovers(b)} coperti, menù ${b.menu?.name ?? "da definire"}${allergyCount > 0 ? `, ${allergyCount} allergie` : ""}`}
        className={cn(
          "block border-l-[3px] bg-cream/70 px-2 py-1.5 text-[12px] leading-snug text-ink transition-colors duration-200 hover:bg-sand/60",
          STATUS_BORDER_LEFT[b.status],
          b.status === "annullato" && "line-through opacity-70",
          className,
        )}
      >
        <span className="flex items-center gap-1.5 font-medium">
          {dateLabel && <span>{dateLabel}</span>}
          {time && <span className="tabular-nums">{time}</span>}
          {allergyCount > 0 && (
            <span
              className="ml-auto inline-flex items-center gap-0.5 text-danger"
              title={`${allergyCount} ${allergyCount === 1 ? "allergia" : "allergie"}`}
            >
              <TriangleAlert aria-hidden="true" className="size-3" />
              <span className="text-[11px] tabular-nums">{allergyCount}</span>
              <span className="sr-only">{allergyCount} allergie</span>
            </span>
          )}
        </span>
        <span className="block truncate">{title}</span>
        <span className="block truncate text-slate-dark">
          {b.room?.name ?? "Sala da assegnare"} · {formatCovers(b)}
        </span>
        <span className="block truncate font-medium text-petrol">
          {b.menu?.name ?? "Menù da definire"}
        </span>
      </Link>
    );
  }

  const groups = groupDishes(b.dishes);

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[2px] border border-sand border-t-[3px] bg-paper p-5 shadow-sm shadow-ink/5",
        STATUS_BORDER_TOP[b.status],
        className,
      )}
    >
      <header className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
          {dateLabel && <span>{dateLabel}</span>}
          {time && <span>ore {time}</span>}
          {b.room && <span>{b.room.name}</span>}
        </p>
        <h3 className="font-serif text-xl leading-tight">
          <Link
            href={href}
            className="rounded-[2px] underline-offset-4 hover:text-petrol hover:underline"
          >
            {title}
          </Link>
        </h3>
        {b.event_name && (
          <p className="text-[14px] text-slate-dark">
            {clientFullName(b)} · {b.client.phone}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          <Badge tone="neutral" title="A = adulti, B = bambini">
            {formatCovers(b)}
          </Badge>
          {b.kids_menus > 0 && <Badge tone="petrol">Menù bambini ×{b.kids_menus}</Badge>}
          {allergyCount > 0 && (
            <Badge tone="danger">
              <TriangleAlert aria-hidden="true" className="size-3" />
              {allergyCount} {allergyCount === 1 ? "allergia" : "allergie"}
            </Badge>
          )}
        </div>
      </header>

      {b.setup_colors.length > 0 && (
        <div className="flex items-center gap-2 text-[13px] text-slate-dark">
          <ColorDots colors={b.setup_colors} />
          <span>{b.setup_colors.join(", ")}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-sand pt-3">
        <p className="text-[13px] text-slate-dark">
          Menù:{" "}
          <span className="font-medium text-ink">{b.menu?.name ?? "non selezionato"}</span>
        </p>

        {dishes !== "hidden" && groups.length > 0 &&
          (dishes === "collapsible" ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-[2px] py-1 text-[13px] font-medium text-petrol hover:text-petrol-hover">
                Piatti ({b.dishes.length})
                <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <DishList groups={groups} />
            </details>
          ) : (
            <DishList groups={groups} />
          ))}
      </div>

      {allergyCount > 0 && (
        <div className="border-l-[3px] border-danger bg-danger/5 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-danger">
            Allergie e patologie
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[14px] text-ink">
            {b.allergies.map((allergy) => (
              <li key={allergy.id}>
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
    <dl className="flex flex-col gap-2.5">
      {groups.map((group) => (
        <div key={group.course}>
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-bronze">
            {group.label}
          </dt>
          <dd>
            <ul className="text-[14px] leading-snug text-ink">
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
