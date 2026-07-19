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
import {
  createCryptoPayment,
  getCryptoDepositQuote,
  verifyIpnSignature,
  CRYPTO_MIN_WITHDRAW_USD,
} from "../lib/nowpayments.js";

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

    const result = await createCryptoPayment(userId, amountGhs);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    const [payment] = await db
      .insert(cryptoPayments)
      .values({
        userId,
        network: "TRC20",
        asset: "USDT",
        amount: result.payAmount!,
        status: "waiting",
        providerPaymentId: result.paymentId,
        amountGhs: amountGhs.toFixed(2),
        payAmount: result.payAmount,
        payCurrency: result.payCurrency,
        payAddress: result.payAddress,
      })
      .returning();

    res.status(201).json({
      paymentId: payment.id,
      payAddress: result.payAddress,
      payAmount: result.payAmount,
      payCurrency: result.payCurrency,
    });
  },
);

paymentsRouter.post("/crypto/ipn", async (req, res) => {
  const signature = req.headers["x-nowpayments-sig"] as string | undefined;
  if (!verifyIpnSignature(req.body, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { payment_id, payment_status } = req.body as {
    payment_id?: number | string;
    payment_status?: string;
  };
  if (!payment_id || !payment_status) {
    return res.status(400).json({ error: "Missing payment_id or payment_status" });
  }

  const [record] = await db
    .select()
    .from(cryptoPayments)
    .where(eq(cryptoPayments.providerPaymentId, String(payment_id)))
    .limit(1);
  if (!record) {
    return res.status(404).json({ error: "Payment not found" });
  }

  const alreadyCredited = record.status === "finished";
  await db
    .update(cryptoPayments)
    .set({ status: payment_status, confirmed: payment_status === "finished" })
    .where(eq(cryptoPayments.id, record.id));

  if (payment_status === "finished" && !alreadyCredited && record.amountGhs) {
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
      reference: String(payment_id),
      description: "Deposit via USDT (TRC20)",
    });
  }

  res.status(200).json({ received: true });
});
