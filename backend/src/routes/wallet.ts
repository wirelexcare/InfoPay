import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  wallets,
  walletTransactions,
  withdrawalMethods,
  users,
  depositSettings,
  depositMethodSettings,
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
import { checkWithdrawalWindow, getPaymentRules } from "../lib/paymentSettings.js";

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

// NOTE: the old POST /deposit endpoint that credited the wallet instantly
// with no payment was a demo shortcut and a critical vulnerability (any user
// could mint unlimited balance). It has been removed. All deposits must flow
// through admin-reviewed manual deposits (/manual-deposits) or the verified
// NOWPayments crypto IPN (routes/payments.ts). Reject any lingering callers.
walletRouter.post("/deposit", requireAuth, (_req, res) => {
  res.status(410).json({
    error:
      "This endpoint has been removed. Top up via mobile money or crypto from the wallet page.",
  });
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

  const rules = await getPaymentRules();
  const window = checkWithdrawalWindow(rules);
  if (!window.allowed) {
    return res.status(400).json({ error: window.reason });
  }
  if (rules.minWithdrawalGhs !== null && amount < rules.minWithdrawalGhs) {
    return res.status(400).json({
      error: `Minimum withdrawal is GHS ${rules.minWithdrawalGhs.toFixed(2)}`,
    });
  }
  if (rules.maxWithdrawalGhs !== null && amount > rules.maxWithdrawalGhs) {
    return res.status(400).json({
      error: `Maximum withdrawal is GHS ${rules.maxWithdrawalGhs.toFixed(2)}`,
    });
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

  await getOrCreateWallet(userId);

  // Fee is charged on the requested amount; the payout the admin sends is
  // the remainder. Recorded in the description for both user and admin.
  const feeGhs = Math.round(amount * (rules.withdrawalFeePct / 100) * 100) / 100;
  const payoutGhs = Math.round((amount - feeGhs) * 100) / 100;

  // Debit atomically with a balance guard so concurrent withdrawals can't
  // overdraw the wallet (the UPDATE only applies if the funds are still
  // there). Returns null when the balance is insufficient.
  const result = await db.transaction(async (tx) => {
    const [debited] = await tx
      .update(wallets)
      .set({
        balanceGhs: sql`${wallets.balanceGhs} - ${amount.toFixed(2)}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wallets.userId, userId),
          gte(wallets.balanceGhs, amount.toFixed(2)),
        ),
      )
      .returning();
    if (!debited) return null;

    const balanceAfter = Number(debited.balanceGhs);
    const balanceBefore = balanceAfter + amount;

    const [txn] = await tx
      .insert(walletTransactions)
      .values({
        userId,
        type: "withdrawal",
        amountGhs: amount.toFixed(2),
        balanceBeforeGhs: balanceBefore.toFixed(2),
        balanceAfterGhs: balanceAfter.toFixed(2),
        status: "pending",
        method: method.type,
        description:
          feeGhs > 0
            ? `Withdrawal to ${method.accountName} · fee GHS ${feeGhs.toFixed(2)} (${rules.withdrawalFeePct}%) · payout GHS ${payoutGhs.toFixed(2)}`
            : `Withdrawal to ${method.accountName}`,
      })
      .returning();
    return { updated: debited, transaction: txn };
  });

  if (!result) {
    return res.status(400).json({ error: "Insufficient wallet balance" });
  }
  const { updated, transaction } = result;

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

// Which deposit methods the admin has made visible; all enabled by default
// until an admin saves a preference.
walletRouter.get("/deposit-methods", requireAuth, async (_req, res) => {
  try {
    const [row] = await db.select().from(depositMethodSettings).limit(1);
    res.json({
      momo: row?.momoEnabled ?? true,
      crypto: row?.cryptoEnabled ?? true,
      chat: row?.chatEnabled ?? true,
    });
  } catch (error) {
    console.error("Error fetching deposit methods:", error);
    res.status(500).json({ error: "Failed to load deposit methods" });
  }
});

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
      // Everything runs inside ONE transaction. The pool row is locked with
      // SELECT ... FOR UPDATE *inside* the transaction, so concurrent claims
      // for the same pool serialize: each sees the committed claimed total of
      // the previous one, which prevents over-claiming past the pool and
      // duplicate claims by the same user. The unique index on
      // (pool_id, user_id) is a hard backstop for the no-duplicate rule.
      const outcome = await db.transaction(async (tx) => {
        const poolResult = await tx.execute(
          sql`SELECT * FROM reward_pools WHERE code = ${code} FOR UPDATE LIMIT 1`,
        );
        if (!poolResult || poolResult.length === 0) {
          return { http: 404, body: { status: "pool_not_found", message: "Reward code not found" } };
        }
        const pool = poolResult[0] as any;

        if (pool.status !== "active") {
          return { http: 400, body: { status: "pool_inactive", message: "This reward pool is no longer active" } };
        }

        if (pool.expires_at && new Date() > new Date(pool.expires_at)) {
          await tx
            .update(rewardPools)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(rewardPools.id, pool.id));
          return { http: 400, body: { status: "pool_expired", message: "This reward pool has expired" } };
        }

        if (!pool.allow_duplicate_claims) {
          const [existing] = await tx
            .select({ id: rewardClaims.id })
            .from(rewardClaims)
            .where(and(eq(rewardClaims.poolId, pool.id), eq(rewardClaims.userId, userId)))
            .limit(1);
          if (existing) {
            return { http: 409, body: { status: "already_claimed", message: "You have already claimed from this reward pool" } };
          }
        }

        // Compute reward amount (guard against a misconfigured min>max range)
        let claimAmount: number;
        if (pool.reward_type === "fixed") {
          claimAmount = Number(pool.fixed_amount_ghs);
        } else {
          const min = Number(pool.min_amount_ghs);
          const max = Number(pool.max_amount_ghs);
          const lo = Math.min(min, max);
          const hi = Math.max(min, max);
          claimAmount = Math.random() * (hi - lo) + lo;
        }
        claimAmount = Math.round(claimAmount * 100) / 100;
        if (!(claimAmount > 0)) {
          return { http: 400, body: { status: "insufficient_pool", message: "This reward pool is misconfigured" } };
        }

        const claimed = Number(pool.claimed_pool_ghs);
        const total = Number(pool.total_pool_ghs);
        if (claimAmount > total - claimed) {
          return { http: 400, body: { status: "insufficient_pool", message: "Total reward amount claimed. Try again with the next provided code" } };
        }

        const newClaimed = Math.round((claimed + claimAmount) * 100) / 100;
        const isExhausted = newClaimed >= total;

        // Credit wallet by atomic increment (create the row if missing)
        await tx.insert(wallets).values({ userId }).onConflictDoNothing();
        const [creditedWallet] = await tx
          .update(wallets)
          .set({
            balanceGhs: sql`${wallets.balanceGhs} + ${claimAmount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, userId))
          .returning();
        const balanceAfter = Number(creditedWallet.balanceGhs);
        const balanceBefore = Math.round((balanceAfter - claimAmount) * 100) / 100;

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

        await tx.insert(rewardClaims).values({
          poolId: pool.id,
          userId,
          claimedAmountGhs: claimAmount.toFixed(2),
          transactionId: txn.id,
          claimResult: "success",
        });

        // Pool update guarded so we can never write past the total
        await tx
          .update(rewardPools)
          .set({
            claimedPoolGhs: newClaimed.toFixed(2),
            status: isExhausted ? "exhausted" : "active",
            updatedAt: new Date(),
          })
          .where(eq(rewardPools.id, pool.id));

        await tx.insert(rewardPoolAudit).values({
          poolId: pool.id,
          action: "REWARD_CLAIMED",
          changes: { claimedAmount: claimAmount, isExhausted, userId },
        });

        return {
          http: 200,
          body: { status: "success", claimAmount, isPoolExhausted: isExhausted },
        };
      });

      res.status(outcome.http).json(outcome.body);
    } catch (error: any) {
      // Unique (pool_id, user_id) violation = concurrent duplicate claim
      if (error?.code === "23505") {
        return res.status(409).json({
          status: "already_claimed",
          message: "You have already claimed from this reward pool",
        });
      }
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
