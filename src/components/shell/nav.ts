import { isAdmin } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

export type NavIcon = "agenda" | "dashboard" | "clients" | "operators" | "catalog";

export interface NavLink {
  href: string;
  label: string;
  icon: NavIcon;
}

const LINKS: Array<NavLink & { adminOnly: boolean }> = [
  { href: "/agenda", label: "Agenda", icon: "agenda", adminOnly: false },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", adminOnly: true },
  { href: "/clienti", label: "Clienti", icon: "clients", adminOnly: true },
  { href: "/operatori", label: "Operatori", icon: "operators", adminOnly: true },
  { href: "/catalogo", label: "Menù & Sale", icon: "catalog", adminOnly: true },
];

/** Voci di navigazione filtrate per ruolo. */
export function getNavLinks(profile: Profile): NavLink[] {
  const admin = isAdmin(profile);
  return LINKS.filter((link) => !link.adminOnly || admin).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );
}
