import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/action-utils";
import type { Quote, QuoteWithBooking } from "@/lib/types";
import { BOOKING_DETAIL_SELECT, assertOk, normalizeQuote, normalizeQuoteWithBooking } from "./shared";

export async function getQuote(id: string): Promise<QuoteWithBooking | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(`*, booking:bookings(${BOOKING_DETAIL_SELECT})`)
    .eq("id", id)
    .maybeSingle();
  assertOk(error);
  return data ? normalizeQuoteWithBooking(data) : null;
}

export async function getQuotesForBooking(bookingId: string): Promise<Quote[]> {
  if (!isUuid(bookingId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  assertOk(error);
  return (data ?? []).map(normalizeQuote);
}
