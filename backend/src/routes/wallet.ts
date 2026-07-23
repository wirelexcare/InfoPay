import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  wallets,
  walletTransactions,
  withdrawalMethods,
  users,
  depositSettings,
  manualDeposits,
  rewardPools,
  rewardClaims,
  rewardPoolAudit,
  auditLogs,
  chatMessages,
} from "../db/schema.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  validateMomoName,
  validateBankAccountName,
  getGhanaBanks,
} from "../lib/moolre.js";
import { CRYPTO_MIN_WITHDRAW_USD } from "../lib/nowpayments.js";
import { getGhsPerUsd } from "../lib/fx.js";
import { generateDepositReference } from "../lib/manualDeposits.js";
import { uploadPaymentScreenshot } from "../lib/storage.js";

export const walletRouter = Router();

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

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
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const wallet = await getOrCreateWallet(userId);
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId));

  res.json({
    wallet,
    transactions,
    transactionsTotal: countResult[0]?.count || 0,
    transactionsPage: page,
    transactionsLimit: limit,
  });
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

// ============ MANUAL MOBILE MONEY DEPOSIT ============

walletRouter.get("/deposit-settings", requireAuth, async (_req, res) => {
  const [settings] = await db
    .select({
      network: depositSettings.network,
      accountName: depositSettings.accountName,
      accountNumber: depositSettings.accountNumber,
    })
    .from(depositSettings)
    .where(eq(depositSettings.key, "momo"))
    .limit(1);

  if (!settings) {
    return res.status(404).json({
      error: "Manual deposits are not configured yet. Please contact support.",
    });
  }
  res.json({ settings });
});

walletRouter.get(
  "/manual-deposits/reference",
  requireAuth,
  async (_req: AuthedRequest, res) => {
    try {
      const reference = await generateDepositReference();
      res.json({ reference });
    } catch (error) {
      console.error("Error generating deposit reference:", error);
      res.status(500).json({ error: "Failed to generate deposit reference" });
    }
  },
);

walletRouter.post(
  "/manual-deposits/screenshot",
  requireAuth,
  screenshotUpload.single("screenshot"),
  async (req: AuthedRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No screenshot file provided" });
    }
    try {
      const url = await uploadPaymentScreenshot(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
      res.json({ url });
    } catch (error) {
      console.error("Error uploading screenshot:", error);
      res.status(500).json({ error: "Failed to upload screenshot" });
    }
  },
);

const manualDepositSchema = z.object({
  reference: z.string().min(3).max(20),
  amountGhs: z.coerce.number().positive(),
  network: z.enum(["mtn", "vodafone", "telecel", "airteltigo"]),
  senderName: z.string().min(2).max(255),
  senderNumber: z.string().min(7).max(30),
  screenshotUrl: z.string().url(),
});

walletRouter.post(
  "/manual-deposits",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = manualDepositSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { reference, amountGhs, network, senderName, senderNumber, screenshotUrl } =
      parsed.data;

    try {
      const [deposit] = await db
        .insert(manualDeposits)
        .values({
          userId: req.user!.userId,
          reference,
          amountGhs: amountGhs.toFixed(2),
          network,
          senderName,
          senderNumber,
          screenshotUrl,
        })
        .returning();

      // Post the top-up request into the user's live chat thread so admins
      // see it in the conversation and the user can track its status there.
      await db.insert(chatMessages).values({
        userId: req.user!.userId,
        senderId: req.user!.userId,
        senderRole: "user",
        manualDepositId: deposit.id,
        readByUser: true,
      });

      res.status(201).json({ deposit });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({
          error: "That reference has already been used. Please refresh and try again.",
        });
      }
      console.error("Error creating manual deposit:", error);
      res.status(500).json({ error: "Failed to submit deposit" });
    }
  },
);

walletRouter.get(
  "/manual-deposits",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const deposits = await db
      .select()
      .from(manualDeposits)
      .where(eq(manualDeposits.userId, req.user!.userId))
      .orderBy(desc(manualDeposits.createdAt))
      .limit(20);
    res.json({ deposits });
  },
);

// ============ REWARD CLAIMS ============

const claimRewardSchema = z.object({
  code: z.string().min(3).max(20),
});

walletRouter.post(
  "/rewards/claim",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = claimRewardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { code } = parsed.data;
    const userId = req.user!.userId;

    try {
      // 1. Fetch pool with FOR UPDATE lock (prevents concurrent updates)
      // Note: Drizzle doesn't have direct FOR UPDATE support yet, so we use raw SQL
      const poolResult = await db.execute(
        sql`SELECT * FROM reward_pools WHERE code = ${code} FOR UPDATE LIMIT 1`,
      );

      if (!poolResult || poolResult.length === 0) {
        return res.status(404).json({
          status: "pool_not_found",
          message: "Reward code not found",
        });
      }

      const pool = poolResult[0] as any;

      // 2. Check pool status
      if (pool.status !== "active") {
        return res.status(400).json({
          status: "pool_inactive",
          message: "This reward pool is no longer active",
        });
      }

      // 3. Check expiration (expiresAt includes time)
      if (pool.expires_at && new Date() > new Date(pool.expires_at)) {
        await db
          .update(rewardPools)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(rewardPools.id, pool.id));
        return res.status(400).json({
          status: "pool_expired",
          message: "This reward pool has expired",
        });
      }

      // 4. Check duplicate claims (if allowDuplicateClaims=false)
      if (!pool.allow_duplicate_claims) {
        const [existing] = await db
          .select({ id: rewardClaims.id })
          .from(rewardClaims)
          .where(and(eq(rewardClaims.poolId, pool.id), eq(rewardClaims.userId, userId)))
          .limit(1);

        if (existing) {
          return res.status(409).json({
            status: "already_claimed",
            message: "You have already claimed from this reward pool",
          });
        }
      }

      // 5. Calculate reward amount
      let claimAmount: number;
      if (pool.reward_type === "fixed") {
        claimAmount = Number(pool.fixed_amount_ghs);
      } else {
        // random_range
        const min = Number(pool.min_amount_ghs);
        const max = Number(pool.max_amount_ghs);
        claimAmount = Math.random() * (max - min) + min;
      }

      // 6. Check if pool has enough remaining
      const claimed = Number(pool.claimed_pool_ghs);
      const total = Number(pool.total_pool_ghs);
      const remaining = total - claimed;

      if (claimAmount > remaining) {
        return res.status(400).json({
          status: "insufficient_pool",
          message: "Total reward amount claimed. Try again with the next provided code",
        });
      }

      // 7. Check if this claim will exhaust the pool
      const newClaimed = claimed + claimAmount;
      const isExhausted = newClaimed >= total;

      // 8. Atomic transaction: wallet credit + claim record + pool update
      await db.transaction(async (tx) => {
        // Get or create wallet
        const [wallet] =
          (await tx
            .insert(wallets)
            .values({ userId })
            .onConflictDoNothing()
            .returning()) || [];

        const [currentWallet] = wallet
          ? [wallet]
          : await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);

        const balanceBefore = Number(currentWallet.balanceGhs);
        const balanceAfter = balanceBefore + claimAmount;

        // Update wallet balance
        await tx
          .update(wallets)
          .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
          .where(eq(wallets.userId, userId));

        // Create wallet transaction
        const [txn] = await tx
          .insert(walletTransactions)
          .values({
            userId,
            type: "reward_claim",
            amountGhs: claimAmount.toFixed(2),
            balanceBeforeGhs: balanceBefore.toFixed(2),
            balanceAfterGhs: balanceAfter.toFixed(2),
            status: "completed",
            reference: code,
            description: `Reward claim from pool ${code}`,
          })
          .returning();

        // Create reward claim record
        await tx.insert(rewardClaims).values({
          poolId: pool.id,
          userId,
          claimedAmountGhs: claimAmount.toFixed(2),
          transactionId: txn.id,
          claimResult: "success",
        });

        // Update pool
        await tx
          .update(rewardPools)
          .set({
            claimedPoolGhs: newClaimed.toFixed(2),
            status: isExhausted ? "exhausted" : "active",
            updatedAt: new Date(),
          })
          .where(eq(rewardPools.id, pool.id));

        // Log to audit trail
        await tx.insert(rewardPoolAudit).values({
          poolId: pool.id,
          action: "REWARD_CLAIMED",
          changes: {
            claimedAmount: claimAmount,
            isExhausted,
            userId,
          },
        });
      });

      res.json({
        status: "success",
        claimAmount,
        isPoolExhausted: isExhausted,
      });
    } catch (error) {
      console.error("Error claiming reward:", error);
      res.status(500).json({ error: "Failed to claim reward" });
    }
  },
);

walletRouter.get(
  "/rewards/history",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = 50;
      const offset = (page - 1) * limit;

      const claims = await db
        .select({
          id: rewardClaims.id,
          poolCode: rewardPools.code,
          claimedAmountGhs: rewardClaims.claimedAmountGhs,
          claimedAt: rewardClaims.claimedAt,
          claimResult: rewardClaims.claimResult,
        })
        .from(rewardClaims)
        .innerJoin(rewardPools, eq(rewardPools.id, rewardClaims.poolId))
        .where(eq(rewardClaims.userId, req.user!.userId))
        .orderBy(desc(rewardClaims.claimedAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(rewardClaims)
        .where(eq(rewardClaims.userId, req.user!.userId));

      res.json({ claims, total: countResult[0]?.count || 0, page, limit });
    } catch (error) {
      console.error("Error fetching reward history:", error);
      res.status(500).json({ error: "Failed to fetch reward history" });
    }
  },
);
