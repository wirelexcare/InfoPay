import { db } from "../db/index.js";
import { paymentSettings } from "../db/schema.js";

export interface PaymentRules {
  momoMinDepositGhs: number | null;
  momoMaxDepositGhs: number | null;
  momoDepositFeePct: number;
  // Crypto deposits are always fee-free; these are optional admin caps on top
  // of the live NOWPayments minimum, which fluctuates with the crypto market.
  cryptoMinDepositGhs: number | null;
  cryptoMaxDepositGhs: number | null;
  minWithdrawalGhs: number | null;
  maxWithdrawalGhs: number | null;
  withdrawalFeePct: number;
  withdrawalDays: number[];
  withdrawalStartTime: string | null;
  withdrawalEndTime: string | null;
}

const num = (v: string | null | undefined): number | null =>
  v == null ? null : Number(v);

export async function getPaymentRules(): Promise<PaymentRules> {
  const [row] = await db.select().from(paymentSettings).limit(1);
  return {
    momoMinDepositGhs: num(row?.momoMinDepositGhs),
    momoMaxDepositGhs: num(row?.momoMaxDepositGhs),
    momoDepositFeePct: Number(row?.momoDepositFeePct ?? 0),
    cryptoMinDepositGhs: num(row?.cryptoMinDepositGhs),
    cryptoMaxDepositGhs: num(row?.cryptoMaxDepositGhs),
    minWithdrawalGhs: num(row?.minWithdrawalGhs),
    maxWithdrawalGhs: num(row?.maxWithdrawalGhs),
    withdrawalFeePct: Number(row?.withdrawalFeePct ?? 0),
    withdrawalDays: row?.withdrawalDays ?? [],
    withdrawalStartTime: row?.withdrawalStartTime ?? null,
    withdrawalEndTime: row?.withdrawalEndTime ?? null,
  };
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Withdrawal windows are evaluated in GMT, which is Ghana local time.
 * Empty day list = every day; missing start/end = any time of day.
 */
export function checkWithdrawalWindow(
  rules: PaymentRules,
  now = new Date(),
): { allowed: boolean; reason?: string } {
  const day = now.getUTCDay();
  if (rules.withdrawalDays.length > 0 && !rules.withdrawalDays.includes(day)) {
    const days = [...rules.withdrawalDays]
      .sort((a, b) => a - b)
      .map((d) => DAY_NAMES[d])
      .join(", ");
    return {
      allowed: false,
      reason: `Withdrawals are only open on: ${days}. Please come back then.`,
    };
  }

  if (rules.withdrawalStartTime && rules.withdrawalEndTime) {
    const [sh, sm] = rules.withdrawalStartTime.split(":").map(Number);
    const [eh, em] = rules.withdrawalEndTime.split(":").map(Number);
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    // Support overnight windows (e.g. 22:00 - 06:00).
    const inWindow =
      start <= end ? mins >= start && mins <= end : mins >= start || mins <= end;
    if (!inWindow) {
      return {
        allowed: false,
        reason: `Withdrawals are only open between ${rules.withdrawalStartTime} and ${rules.withdrawalEndTime} (GMT). Please come back then.`,
      };
    }
  }

  return { allowed: true };
}
