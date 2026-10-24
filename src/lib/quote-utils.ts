import type { Quote, QuoteTotals } from "./types";

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Totali del preventivo. Prezzi IVA inclusa:
 * subtotal = Σ quantity × unit_price; discount è un importo in EUR (limitato al subtotale);
 * total = subtotal − discount; taxable = total / (1 + vat/100); vat = total − taxable.
 */
export function computeQuoteTotals(q: Pick<Quote, "lines" | "discount" | "vat_rate">): QuoteTotals {
  const subtotal = round2(q.lines.reduce((acc, l) => acc + l.quantity * l.unit_price, 0));
  const discount = round2(Math.min(Math.max(q.discount, 0), subtotal));
  const total = round2(subtotal - discount);
  const taxable = round2(total / (1 + q.vat_rate / 100));
  const vat = round2(total - taxable);
  return { subtotal, discount, total, taxable, vat };
}

const eurFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatEUR(n: number): string {
  return eurFormatter.format(n);
}
