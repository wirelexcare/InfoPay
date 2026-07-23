import crypto from "node:crypto";
import { getGhsPerUsd } from "./fx.js";

// Binance Pay Merchant API. Docs: https://developers.binance.com/docs/binance-pay
// Sandbox/prod share the same host; Binance provisions separate merchant
// credentials per environment rather than a different base URL.
const API_BASE = "https://bpay.binanceapi.com";

// On-chain/network minimums make very small crypto payouts impractical.
// Same flat USD-equivalent floor used previously; deposits are additionally
// bounded by the admin-configured min/max deposit in payment rules.
export const CRYPTO_MIN_WITHDRAW_USD = 10;

function nonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Binance Pay signs (and expects signed) requests as:
//   HMAC-SHA512(timestamp + "\n" + nonce + "\n" + body + "\n", secretKey)
// uppercased hex. Both outgoing order-creation calls and incoming webhooks
// use this exact construction.
function sign(timestamp: string, nonceStr: string, body: string, secret: string): string {
  const payload = `${timestamp}\n${nonceStr}\n${body}\n`;
  return crypto.createHmac("sha512", secret).update(payload).digest("hex").toUpperCase();
}

export interface CryptoDepositQuote {
  ghsPerUsd: number;
  // Binance Pay has no live "minimum deposit" lookup like NOWPayments did —
  // the floor is whatever the admin sets in payment rules (min deposit GHS).
  minDepositUsd: number | null;
  minDepositGhs: number | null;
}

export async function getCryptoDepositQuote(): Promise<CryptoDepositQuote> {
  const ghsPerUsd = await getGhsPerUsd();
  return { ghsPerUsd, minDepositUsd: null, minDepositGhs: null };
}

export interface CreatePaymentResult {
  ok: boolean;
  paymentId?: string; // Binance prepayId
  payAmount?: string; // amount in `asset`, e.g. USDT
  payCurrency?: string;
  checkoutUrl?: string;
  qrcodeLink?: string;
  error?: string;
}

const PAY_ASSET = "USDT";

export async function createCryptoPayment(
  userId: string,
  amountGhs: number,
): Promise<CreatePaymentResult> {
  const apiKey = process.env.BINANCE_PAY_API_KEY;
  const secretKey = process.env.BINANCE_PAY_SECRET_KEY;
  if (!apiKey || !secretKey) {
    return { ok: false, error: "Crypto payments are not configured" };
  }

  const ghsPerUsd = await getGhsPerUsd();
  const orderAmount = Number((amountGhs / ghsPerUsd).toFixed(2));

  const body = JSON.stringify({
    env: { terminalType: "APP" },
    merchantTradeNo: `${userId}-${Date.now()}`,
    orderAmount,
    currency: PAY_ASSET,
    goods: {
      goodsType: "02",
      goodsCategory: "Z000",
      referenceGoodsId: "infopay-topup",
      goodsName: "InfoPay wallet top-up",
      goodsDetail: "Wallet top-up",
    },
    ...(process.env.BINANCE_PAY_WEBHOOK_URL
      ? { webhookUrl: process.env.BINANCE_PAY_WEBHOOK_URL }
      : {}),
  });

  const timestamp = String(Date.now());
  const nonceStr = nonce();
  const signature = sign(timestamp, nonceStr, body, secretKey);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/binancepay/openapi/v3/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonceStr,
        "BinancePay-Certificate-SN": apiKey,
        "BinancePay-Signature": signature,
      },
      body,
    });
  } catch (error) {
    console.error("Binance Pay create-order request failed:", error);
    return { ok: false, error: "Crypto payment service is temporarily unavailable" };
  }

  const result = (await response.json().catch(() => null)) as {
    status?: string;
    code?: string;
    errorMessage?: string;
    data?: {
      prepayId?: string;
      checkoutUrl?: string;
      qrcodeLink?: string;
    };
  } | null;

  if (!response.ok || result?.status !== "SUCCESS" || !result.data?.prepayId) {
    return {
      ok: false,
      error: result?.errorMessage ?? "Could not create crypto payment",
    };
  }

  return {
    ok: true,
    paymentId: result.data.prepayId,
    payAmount: String(orderAmount),
    payCurrency: PAY_ASSET,
    checkoutUrl: result.data.checkoutUrl,
    qrcodeLink: result.data.qrcodeLink,
  };
}

/**
 * Verifies a Binance Pay webhook using the same timestamp/nonce/body
 * signature construction as order creation. `rawBody` must be the exact
 * bytes Binance sent (before any JSON re-serialization) — pass an
 * express.raw() buffer stringified, not JSON.stringify(req.body).
 */
export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | undefined,
  nonceStr: string | undefined,
  signature: string | undefined,
): boolean {
  const secret = process.env.BINANCE_PAY_SECRET_KEY;
  if (!secret || !timestamp || !nonceStr || !signature) return false;
  const expected = sign(timestamp, nonceStr, rawBody, secret);
  return expected === signature;
}
