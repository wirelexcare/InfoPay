import crypto from "node:crypto";
import { getGhsPerUsd } from "./fx.js";

const API_BASE = "https://api.nowpayments.io/v1";
const MIN_AMOUNT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Flat USD-equivalent floor for crypto withdrawals — on-chain network fees
// make very small payouts impractical, unlike deposits (whose minimum
// comes live from NOWPayments and fluctuates with network conditions).
export const CRYPTO_MIN_WITHDRAW_USD = 10;

let cachedMinUsd: number | null = null;
let cachedMinAt = 0;

async function getMinUsdAmount(): Promise<number | null> {
  const now = Date.now();
  if (cachedMinUsd !== null && now - cachedMinAt < MIN_AMOUNT_CACHE_TTL_MS) {
    return cachedMinUsd;
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `${API_BASE}/min-amount?currency_from=usd&currency_to=usdttrc20&fiat_equivalent=usd`,
      { headers: { "x-api-key": apiKey } },
    );
    const body = (await response.json().catch(() => null)) as {
      fiat_equivalent?: number;
      min_amount?: number;
    } | null;
    const min = body?.fiat_equivalent ?? body?.min_amount;
    if (response.ok && typeof min === "number" && min > 0) {
      cachedMinUsd = min;
      cachedMinAt = now;
      return min;
    }
  } catch {
    // fall through to cached/null below
  }

  return cachedMinUsd;
}

export interface CryptoDepositQuote {
  ghsPerUsd: number;
  minDepositUsd: number | null;
  minDepositGhs: number | null;
}

export async function getCryptoDepositQuote(): Promise<CryptoDepositQuote> {
  const [ghsPerUsd, minDepositUsd] = await Promise.all([
    getGhsPerUsd(),
    getMinUsdAmount(),
  ]);
  return {
    ghsPerUsd,
    minDepositUsd,
    minDepositGhs: minDepositUsd !== null ? minDepositUsd * ghsPerUsd : null,
  };
}

export interface CreatePaymentResult {
  ok: boolean;
  paymentId?: string;
  payAddress?: string;
  payAmount?: string;
  payCurrency?: string;
  error?: string;
}

export async function createCryptoPayment(
  userId: string,
  amountGhs: number,
): Promise<CreatePaymentResult> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const callbackUrl = process.env.NOWPAYMENTS_IPN_CALLBACK_URL;
  if (!apiKey || !callbackUrl) {
    return { ok: false, error: "Crypto payments are not configured" };
  }

  const quote = await getCryptoDepositQuote();
  if (quote.minDepositGhs !== null && amountGhs < quote.minDepositGhs) {
    return {
      ok: false,
      error: `Minimum crypto deposit is GHS ${quote.minDepositGhs.toFixed(2)}`,
    };
  }

  const priceAmountUsd = Number((amountGhs / quote.ghsPerUsd).toFixed(2));

  const response = await fetch(`${API_BASE}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      price_amount: priceAmountUsd,
      price_currency: "usd",
      pay_currency: "usdttrc20",
      order_id: `${userId}-${Date.now()}`,
      order_description: "AfriHome wallet top-up",
      ipn_callback_url: callbackUrl,
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    payment_id?: number | string;
    pay_address?: string;
    pay_amount?: number | string;
    pay_currency?: string;
    message?: string;
  } | null;

  if (!response.ok || !body?.payment_id) {
    return {
      ok: false,
      error: body?.message ?? "Could not create crypto payment",
    };
  }

  return {
    ok: true,
    paymentId: String(body.payment_id),
    payAddress: body.pay_address,
    payAmount: String(body.pay_amount),
    payCurrency: body.pay_currency,
  };
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function sortObject(obj: JsonValue): JsonValue {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject((obj as Record<string, JsonValue>)[key]);
        return acc;
      }, {} as Record<string, JsonValue>);
  }
  return obj;
}

export function verifyIpnSignature(
  payload: JsonValue,
  signature: string | undefined,
): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;
  const sorted = sortObject(payload);
  const digest = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(sorted))
    .digest("hex");
  return digest === signature;
}
