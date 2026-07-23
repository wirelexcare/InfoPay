// Static indicative rates, GHS -> target currency. Replace with a live
// FX rate feed before going to production.
export const GHS_EXCHANGE_RATES: Record<string, number> = {
  GHS: 1,
  NGN: 108,
  KES: 11.3,
  ZAR: 1.55,
  UGX: 322,
  TZS: 210,
  RWF: 113,
  XOF: 51.5,
  ETB: 10.2,
  EGP: 4.1,
  MAD: 0.83,
  ZMW: 2.2,
  ZWL: 1450,
  XAF: 51.5,
  GMD: 5.6,
  SLL: 1750,
  LRD: 15.8,
  USD: 0.078,
};

export function convertFromGhs(amountGhs: number, currency: string): number {
  const rate = GHS_EXCHANGE_RATES[currency.toUpperCase()] ?? 1;
  return amountGhs * rate;
}

export function formatCurrency(amount: number, currency: string): string {
  // Show cents when present (e.g. reward claims), keep whole amounts clean.
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
