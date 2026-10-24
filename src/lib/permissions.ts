import type { Profile } from "./types";

/** Puro (senza server-only): usabile anche nei Client Component. */
export function isAdmin(p: Profile): boolean {
  return p.active && p.role === "admin";
}

/** Admin o sala: possono modificare solo i coperti. */
export function canEditCovers(p: Profile): boolean {
  return p.active && (p.role === "admin" || p.role === "sala");
}

/** Admin o cucina con flag chef: possono modificare i piatti. */
export function canEditDishes(p: Profile): boolean {
  return p.active && (p.role === "admin" || (p.role === "cucina" && p.is_chef));
}
