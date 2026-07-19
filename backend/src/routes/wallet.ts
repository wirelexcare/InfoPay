import { Router } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  wallets,
  walletTransactions,
  withdrawalMethods,
  users,
} from "../db/schema.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  validateMomoName,
  validateBankAccountName,
  getGhanaBanks,
} from "../lib/moolre.js";
import { CRYPTO_MIN_WITHDRAW_USD } from "../lib/nowpayments.js";
import { getGhsPerUsd } from "../lib/fx.js";

export const walletRouter = Router();

const verifyMomoSchema = z.object({
  phoneNumber: z.string().min(7),
  network: z.enum(["mtn", "vodafone", "telecel", "airteltigo"]),
});

walletRouter.post(
  "/verify-momo-name",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = verifyMomoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result = await validateMomoName(
      parsed.data.phoneNumber,
      parsed.data.network,
    );
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ name: result.name });
  },
);

const verifyBankSchema = z.object({
  accountNumber: z.string().min(4),
  bankCode: z.string().min(1),
});

walletRouter.post(
  "/verify-bank-name",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = verifyBankSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result = await validateBankAccountName(
      parsed.data.accountNumber,
      parsed.data.bankCode,
    );
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ name: result.name });
  },
);

walletRouter.get("/banks", requireAuth, async (_req, res) => {
  const banks = await getGhanaBanks();
  res.json({ banks });
});

async function getOrCreateWallet(userId: string) {
  const [existing] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(wallets)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [row] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  return row;
}

walletRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.userId;
  const wallet = await getOrCreateWallet(userId);
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(50);

  res.json({ wallet, transactions });
});

const depositSchema = z.object({
  amountGhs: z.string(),
  method: z.enum(["momo", "bank", "crypto"]),
});

walletRouter.post("/deposit", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const userId = req.user!.userId;
  const amount = Number(parsed.data.amountGhs);
  if (!(amount > 0)) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  const wallet = await getOrCreateWallet(userId);
  const balanceBefore = Number(wallet.balanceGhs);
  const balanceAfter = balanceBefore + amount;

  // NOTE: this credits the wallet immediately for demo purposes. In
  // production this must only happen after the Paystack/crypto payment
  // provider confirms the funds actually arrived (see routes/payments.ts).
  const [updated] = await db
    .update(wallets)
    .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
    .where(eq(wallets.userId, userId))
    .returning();

  const [transaction] = await db
    .insert(walletTransactions)
    .values({
      userId,
      type: "deposit",
      amountGhs: amount.toFixed(2),
      balanceBeforeGhs: balanceBefore.toFixed(2),
      balanceAfterGhs: balanceAfter.toFixed(2),
      status: "completed",
      method: parsed.data.method,
      description: `Deposit via ${parsed.data.method}`,
    })
    .returning();

  res.status(201).json({ wallet: updated, transaction });
});

const withdrawSchema = z.object({
  amountGhs: z.string(),
  methodId: z.string().uuid(),
});

walletRouter.post("/withdraw", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const userId = req.user!.userId;
  const amount = Number(parsed.data.amountGhs);
  if (!(amount > 0)) {
    return res.status(400).json({ error: "Amount must be greater than zero" });
  }

  const [method] = await db
    .select()
    .from(withdrawalMethods)
    .where(eq(withdrawalMethods.id, parsed.data.methodId))
    .limit(1);
  if (!method || method.userId !== userId) {
    return res.status(404).json({ error: "Withdrawal method not found" });
  }

  if (method.type === "crypto") {
    const ghsPerUsd = await getGhsPerUsd();
    const minWithdrawGhs = CRYPTO_MIN_WITHDRAW_USD * ghsPerUsd;
    if (amount < minWithdrawGhs) {
      return res.status(400).json({
        error: `Minimum crypto withdrawal is GHS ${minWithdrawGhs.toFixed(2)}`,
      });
    }
  }

  const wallet = await getOrCreateWallet(userId);
  const balanceBefore = Number(wallet.balanceGhs);
  if (amount > balanceBefore) {
    return res.status(400).json({ error: "Insufficient wallet balance" });
  }
  const balanceAfter = balanceBefore - amount;

  const [updated] = await db
    .update(wallets)
    .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
    .where(eq(wallets.userId, userId))
    .returning();

  const [transaction] = await db
    .insert(walletTransactions)
    .values({
      userId,
      type: "withdrawal",
      amountGhs: amount.toFixed(2),
      balanceBeforeGhs: balanceBefore.toFixed(2),
      balanceAfterGhs: balanceAfter.toFixed(2),
      status: "pending",
      method: method.type,
      description: `Withdrawal to ${method.accountName}`,
    })
    .returning();

  res.status(201).json({ wallet: updated, transaction });
});

const methodSchema = z.object({
  type: z.enum(["momo", "bank", "crypto"]),
  network: z.string().optional(),
  accountName: z.string().min(2),
  accountNumber: z.string().optional(),
  cryptoAddress: z.string().optional(),
  isDefault: z.boolean().optional(),
});

walletRouter.get("/methods", requireAuth, async (req: AuthedRequest, res) => {
  const methods = await db
    .select()
    .from(withdrawalMethods)
    .where(eq(withdrawalMethods.userId, req.user!.userId));
  res.json({ methods });
});

walletRouter.post("/methods", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = methodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const userId = req.user!.userId;

  if (parsed.data.type === "momo" || parsed.data.type === "bank") {
    const [user] = await db
      .select({ country: users.country })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user?.country !== "GH") {
      return res.status(400).json({
        error: "Mobile Money and Bank Transfer are only available to Ghanaian clients",
      });
    }
  }

  if (parsed.data.isDefault) {
    await db
      .update(withdrawalMethods)
      .set({ isDefault: false })
      .where(eq(withdrawalMethods.userId, userId));
  }

  const [method] = await db
    .insert(withdrawalMethods)
    .values({ userId, ...parsed.data })
    .returning();
  res.status(201).json({ method });
});

walletRouter.delete(
  "/methods/:id",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const [method] = await db
      .select()
      .from(withdrawalMethods)
      .where(eq(withdrawalMethods.id, req.params.id))
      .limit(1);
    if (!method || method.userId !== req.user!.userId) {
      return res.status(404).json({ error: "Withdrawal method not found" });
    }
    await db
      .delete(withdrawalMethods)
      .where(eq(withdrawalMethods.id, req.params.id));
    res.status(204).send();
  },
);
