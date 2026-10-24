import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getMenus, getRooms } from "@/lib/data/catalog";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { MenusPanel } from "@/components/catalog/MenusPanel";
import { RoomsPanel } from "@/components/catalog/RoomsPanel";

export const metadata: Metadata = {
  title: "Menù & Sale · Casale del Notaio",
};

type SearchParams = Promise<{ tab?: string }>;

const TABS = [
  { key: "menu", label: "Menù" },
  { key: "sale", label: "Sale" },
] as const;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const { tab } = await searchParams;
  const current = tab === "sale" ? "sale" : "menu";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Catalogo"
        title="Menù & Sale"
        description="Menù per banchetto con piatti per portata, e sale con capienza. I menù non vengono mai eliminati: quelli non più in uso si disattivano."
      />

      <nav aria-label="Sezioni del catalogo" className="border-b border-sand">
        <ul className="flex gap-6">
          {TABS.map((item) => {
            const active = item.key === current;
            return (
              <li key={item.key}>
                <Link
                  href={`/catalogo?tab=${item.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex border-b-2 pb-3 text-[13px] font-medium uppercase tracking-[0.14em] transition-colors duration-300",
                    active
                      ? "border-petrol text-petrol"
                      : "border-transparent text-slate-dark hover:border-sand hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {current === "menu" ? <MenusTab /> : <RoomsTab />}
    </div>
  );
}

async function MenusTab() {
  const menus = await getMenus({ includeInactive: true });
  return <MenusPanel menus={menus} />;
}

async function RoomsTab() {
  const rooms = await getRooms({ includeInactive: true });
  return <RoomsPanel rooms={rooms} />;
}
