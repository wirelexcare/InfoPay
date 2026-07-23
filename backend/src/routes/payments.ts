import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  investments,
  cryptoPayments,
  wallets,
  walletTransactions,
} from "../db/schema.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getPaymentRules } from "../lib/paymentSettings.js";
import type { RequestWithRawBody } from "../app.js";
import {
  createCryptoPayment,
  getCryptoDepositQuote,
  verifyWebhookSignature,
  CRYPTO_MIN_WITHDRAW_USD,
} from "../lib/binance.js";

export const paymentsRouter = Router();

paymentsRouter.get("/crypto/quote", requireAuth, async (_req, res) => {
  const quote = await getCryptoDepositQuote();
  res.json({
    ...quote,
    minWithdrawUsd: CRYPTO_MIN_WITHDRAW_USD,
    minWithdrawGhs: CRYPTO_MIN_WITHDRAW_USD * quote.ghsPerUsd,
  });
});

const initSchema = z.object({
  investmentId: z.string().uuid(),
});

paymentsRouter.post(
  "/paystack/initialize",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = initSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: "Paystack is not configured" });
    }

    const [investment] = await db
      .select()
      .from(investments)
      .where(eq(investments.id, parsed.data.investmentId))
      .limit(1);
    if (!investment || investment.userId !== req.user!.userId) {
      return res.status(404).json({ error: "Investment not found" });
    }

    // Placeholder: call Paystack's /transaction/initialize endpoint here
    // with secretKey and investment.amountGhs, then return the auth URL.
    res.json({
      message: "Paystack initialization not yet wired to live API",
      investmentId: investment.id,
    });
  },
);

paymentsRouter.post("/paystack/callback", async (_req, res) => {
  // Placeholder: verify the Paystack webhook signature and update
  // the related investment/payout status.
  res.status(200).json({ received: true });
});

const cryptoPaymentSchema = z.object({
  investmentId: z.string().uuid().optional(),
  network: z.string().default("TRC20"),
  asset: z.string().default("USDT"),
  amount: z.string(),
  txHash: z.string().optional(),
});

paymentsRouter.post("/crypto", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = cryptoPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const [payment] = await db
    .insert(cryptoPayments)
    .values({ userId: req.user!.userId, ...parsed.data })
    .returning();
  res.status(201).json({ payment });
});

const createCryptoDepositSchema = z.object({
  amountGhs: z.string(),
});

paymentsRouter.post(
  "/crypto/create",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = createCryptoDepositSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const userId = req.user!.userId;
    const amountGhs = Number(parsed.data.amountGhs);
    if (!(amountGhs > 0)) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    const rules = await getPaymentRules();
    if (rules.minDepositGhs !== null && amountGhs < rules.minDepositGhs) {
      return res.status(400).json({
        error: `Minimum deposit is GHS ${rules.minDepositGhs.toFixed(2)}`,
      });
    }
    if (rules.maxDepositGhs !== null && amountGhs > rules.maxDepositGhs) {
      return res.status(400).json({
        error: `Maximum deposit is GHS ${rules.maxDepositGhs.toFixed(2)}`,
      });
    }

    // Fee is charged on top: the user pays intended + fee, and the full
    // intended amount is what gets credited (stored in amountGhs).
    const feeGhs = Math.round(amountGhs * (rules.depositFeePct / 100) * 100) / 100;
    const payGhs = Math.round((amountGhs + feeGhs) * 100) / 100;

    const result = await createCryptoPayment(userId, payGhs);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    const [payment] = await db
      .insert(cryptoPayments)
      .values({
        userId,
        network: "BEP20",
        asset: "USDT",
        amount: result.payAmount!,
        status: "waiting",
        providerPaymentId: result.paymentId,
        amountGhs: amountGhs.toFixed(2),
        payAmount: result.payAmount,
        payCurrency: result.payCurrency,
        checkoutUrl: result.checkoutUrl,
        qrcodeLink: result.qrcodeLink,
      })
      .returning();

    res.status(201).json({
      paymentId: payment.id,
      payAmount: result.payAmount,
      payCurrency: result.payCurrency,
      checkoutUrl: result.checkoutUrl,
      qrcodeLink: result.qrcodeLink,
    });
  },
);

// Binance Pay webhook. Configure this route's full URL as the merchant
// webhook endpoint in the Binance Merchant portal.
paymentsRouter.post("/crypto/binance-webhook", async (req: RequestWithRawBody, res) => {
  const timestamp = req.headers["binancepay-timestamp"] as string | undefined;
  const nonce = req.headers["binancepay-nonce"] as string | undefined;
  const signature = req.headers["binancepay-signature"] as string | undefined;

  if (!verifyWebhookSignature(req.rawBody ?? "", timestamp, nonce, signature)) {
    return res.status(401).json({ returnCode: "FAIL", returnMessage: "Invalid signature" });
  }

  const { bizStatus, data } = req.body as {
    bizStatus?: string;
    data?: string;
  };
  const parsedData = (() => {
    try {
      return data ? (JSON.parse(data) as { prepayId?: string }) : null;
    } catch {
      return null;
    }
  })();
  const prepayId = parsedData?.prepayId;
  if (!prepayId || !bizStatus) {
    return res.status(400).json({ returnCode: "FAIL", returnMessage: "Missing prepayId or bizStatus" });
  }

  const [record] = await db
    .select()
    .from(cryptoPayments)
    .where(eq(cryptoPayments.providerPaymentId, prepayId))
    .limit(1);
  if (!record) {
    return res.status(404).json({ returnCode: "FAIL", returnMessage: "Payment not found" });
  }

  const alreadyCredited = record.status === "PAY_SUCCESS";
  await db
    .update(cryptoPayments)
    .set({ status: bizStatus, confirmed: bizStatus === "PAY_SUCCESS" })
    .where(eq(cryptoPayments.id, record.id));

  if (bizStatus === "PAY_SUCCESS" && !alreadyCredited && record.amountGhs) {
    // The deposit fee was already charged on top at invoice time, so the
    // stored amountGhs is exactly what the user gets credited.
    const amount = Number(record.amountGhs);

    const [inserted] = await db
      .insert(wallets)
      .values({ userId: record.userId })
      .onConflictDoNothing()
      .returning();
    const [wallet] =
      inserted !== undefined
        ? [inserted]
        : await db
            .select()
            .from(wallets)
            .where(eq(wallets.userId, record.userId))
            .limit(1);

    const balanceBefore = Number(wallet.balanceGhs);
    const balanceAfter = balanceBefore + amount;

    await db
      .update(wallets)
      .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
      .where(eq(wallets.userId, record.userId));

    await db.insert(walletTransactions).values({
      userId: record.userId,
      type: "deposit",
      amountGhs: amount.toFixed(2),
      balanceBeforeGhs: balanceBefore.toFixed(2),
      balanceAfterGhs: balanceAfter.toFixed(2),
      status: "completed",
      method: "crypto",
      reference: prepayId,
      description: "Deposit via USDT (Binance Pay)",
    });
  }

  res.status(200).json({ returnCode: "SUCCESS", returnMessage: null });
});
