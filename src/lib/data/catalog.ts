import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Menu, Room } from "@/lib/types";
import { MENU_SELECT, assertOk, normalizeMenu, num } from "./shared";

export async function getRooms(opts?: { includeInactive?: boolean }): Promise<Room[]> {
  const supabase = await createClient();
  let query = supabase.from("rooms").select("*").order("sort").order("name");
  if (!opts?.includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  assertOk(error);
  return (data ?? []).map((r: Room) => ({ ...r, capacity: num(r.capacity), sort: num(r.sort) }));
}

export async function getMenus(opts?: { includeInactive?: boolean }): Promise<Menu[]> {
  const supabase = await createClient();
  let query = supabase.from("menus").select(MENU_SELECT).order("sort").order("name");
  if (!opts?.includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  assertOk(error);
  return (data ?? []).map(normalizeMenu);
}
