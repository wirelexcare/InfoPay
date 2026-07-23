import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  investments,
  projects,
  portfolios,
  wallets,
  walletTransactions,
  payouts,
} from "../db/schema.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { creditReferralRewards } from "../lib/referrals.js";

export const investmentsRouter = Router();

const createInvestmentSchema = z.object({
  projectId: z.string().uuid(),
});

investmentsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createInvestmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const userId = req.user!.userId;
  const { projectId } = parsed.data;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project || !project.isActive) {
    return res.status(404).json({ error: "Package not found" });
  }

  // Each package has one fixed investment amount — no range, no client input.
  const amountGhs = project.minInvestmentGhs;
  const amount = Number(amountGhs);

  // Debit the stake, create the investment, and bump the portfolio in one
  // transaction. The wallet debit is a guarded atomic UPDATE so concurrent
  // invests can't spend the same balance twice (returns null if the funds
  // aren't there anymore).
  await db.insert(wallets).values({ userId }).onConflictDoNothing();

  const investment = await db.transaction(async (tx) => {
    const [debited] = await tx
      .update(wallets)
      .set({
        balanceGhs: sql`${wallets.balanceGhs} - ${amount.toFixed(2)}`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(wallets.userId, userId), gte(wallets.balanceGhs, amount.toFixed(2))),
      )
      .returning();
    if (!debited) return null;

    const balanceAfter = Number(debited.balanceGhs);
    const balanceBefore = Math.round((balanceAfter + amount) * 100) / 100;

    const [inv] = await tx
      .insert(investments)
      .values({ userId, projectId, amountGhs, status: "active" })
      .returning();

    await tx.insert(walletTransactions).values({
      userId,
      type: "investment",
      amountGhs: amount.toFixed(2),
      balanceBeforeGhs: balanceBefore.toFixed(2),
      balanceAfterGhs: balanceAfter.toFixed(2),
      status: "completed",
      description: `Investment in ${project.title}`,
    });

    await tx
      .insert(portfolios)
      .values({ userId, totalInvestedGhs: amountGhs })
      .onConflictDoUpdate({
        target: portfolios.userId,
        set: {
          totalInvestedGhs: sql`${portfolios.totalInvestedGhs} + ${amountGhs}`,
          updatedAt: new Date(),
        },
      });

    return inv;
  });

  if (!investment) {
    return res.status(400).json({
      error: "Insufficient wallet balance. Top up your wallet first.",
    });
  }

  await creditReferralRewards(userId, investment.id, amountGhs).catch((err) =>
    console.error("Failed to credit referral rewards:", err),
  );

  res.status(201).json({ investment });
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

investmentsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.userId;
  const list = await db
    .select({
      id: investments.id,
      projectId: investments.projectId,
      amountGhs: investments.amountGhs,
      status: investments.status,
      createdAt: investments.createdAt,
      projectTitle: projects.title,
      projectImageUrl: projects.imageUrl,
    })
    .from(investments)
    .innerJoin(projects, eq(projects.id, investments.projectId))
    .where(eq(investments.userId, userId));

  // Flag investments with today's ROI still waiting to be claimed
  let claimableIds: string[] = [];
  if (list.length > 0) {
    const claimable = await db
      .select({ investmentId: payouts.investmentId })
      .from(payouts)
      .where(
        and(
          inArray(
            payouts.investmentId,
            list.map((i) => i.id),
          ),
          eq(payouts.status, "scheduled"),
          gte(payouts.scheduledFor, startOfToday()),
        ),
      );
    claimableIds = claimable.map((c) => c.investmentId);
  }
  const claimableSet = new Set(claimableIds);

  res.json({
    investments: list.map((i) => ({
      ...i,
      hasClaimableRoi: claimableSet.has(i.id),
    })),
  });
});

investmentsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const [investment] = await db
    .select()
    .from(investments)
    .where(eq(investments.id, req.params.id))
    .limit(1);
  if (!investment || investment.userId !== req.user!.userId) {
    return res.status(404).json({ error: "Investment not found" });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, investment.projectId))
    .limit(1);

  const paidPayouts = await db
    .select()
    .from(payouts)
    .where(
      and(eq(payouts.investmentId, investment.id), eq(payouts.status, "paid")),
    );

  const totalEarnedGhs = paidPayouts
    .reduce((sum, p) => sum + Number(p.amountGhs), 0)
    .toFixed(2);

  // Today's unclaimed ROI, if any, plus the recent claim history
  const [claimablePayout] = await db
    .select({
      id: payouts.id,
      amountGhs: payouts.amountGhs,
      scheduledFor: payouts.scheduledFor,
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.investmentId, investment.id),
        eq(payouts.status, "scheduled"),
        gte(payouts.scheduledFor, startOfToday()),
      ),
    )
    .limit(1);

  const roiHistory = await db
    .select({
      id: payouts.id,
      amountGhs: payouts.amountGhs,
      status: payouts.status,
      scheduledFor: payouts.scheduledFor,
      paidAt: payouts.paidAt,
    })
    .from(payouts)
    .where(eq(payouts.investmentId, investment.id))
    .orderBy(desc(payouts.scheduledFor))
    .limit(30);

  res.json({
    investment,
    project,
    totalEarnedGhs,
    claimablePayout: claimablePayout ?? null,
    roiHistory,
  });
});

// Claim today's accrued ROI into the wallet. Unclaimed ROI is forfeited
// when the next day's accrual runs.
investmentsRouter.post(
  "/:id/claim-roi",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const userId = req.user!.userId;

    const [investment] = await db
      .select()
      .from(investments)
      .where(eq(investments.id, req.params.id))
      .limit(1);
    if (!investment || investment.userId !== userId) {
      return res.status(404).json({ error: "Investment not found" });
    }

    try {
      const [payout] = await db
        .select()
        .from(payouts)
        .where(
          and(
            eq(payouts.investmentId, investment.id),
            eq(payouts.status, "scheduled"),
          ),
        )
        .orderBy(desc(payouts.scheduledFor))
        .limit(1);

      if (!payout) {
        return res.status(404).json({ error: "No ROI to claim right now" });
      }

      const today = startOfToday();
      if (payout.scheduledFor < today) {
        // Stale claim the accrual job hasn't expired yet; forfeit it now.
        await db
          .update(payouts)
          .set({ status: "forfeited" })
          .where(eq(payouts.id, payout.id));
        return res
          .status(410)
          .json({ error: "This ROI claim has expired and was forfeited" });
      }

      const amount = Number(payout.amountGhs);

      const claimed = await db.transaction(async (tx) => {
        // Mark claimed first with a status guard so double-clicks and
        // concurrent requests can't credit twice.
        const updated = await tx
          .update(payouts)
          .set({ status: "paid", paidAt: new Date() })
          .where(and(eq(payouts.id, payout.id), eq(payouts.status, "scheduled")))
          .returning({ id: payouts.id });
        if (updated.length === 0) return null;

        await tx.insert(wallets).values({ userId }).onConflictDoNothing();
        const [credited] = await tx
          .update(wallets)
          .set({
            balanceGhs: sql`${wallets.balanceGhs} + ${amount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, userId))
          .returning();

        const balanceAfter = Number(credited.balanceGhs);
        const balanceBefore = Math.round((balanceAfter - amount) * 100) / 100;

        const [projectRow] = await tx
          .select({ title: projects.title })
          .from(projects)
          .where(eq(projects.id, investment.projectId))
          .limit(1);

        await tx.insert(walletTransactions).values({
          userId,
          type: "payout",
          amountGhs: amount.toFixed(2),
          balanceBeforeGhs: balanceBefore.toFixed(2),
          balanceAfterGhs: balanceAfter.toFixed(2),
          status: "completed",
          description: `ROI claim from ${projectRow?.title ?? "investment"}`,
        });

        await tx
          .update(portfolios)
          .set({
            totalReturnsGhs: sql`${portfolios.totalReturnsGhs} + ${amount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(portfolios.userId, userId));

        return { balanceAfter };
      });

      if (!claimed) {
        return res.status(409).json({ error: "This ROI was already claimed" });
      }

      res.json({
        success: true,
        claimedGhs: amount.toFixed(2),
        balanceAfter: claimed.balanceAfter,
      });
    } catch (error) {
      console.error("Error claiming ROI:", error);
      res.status(500).json({ error: "Failed to claim ROI" });
    }
  },
);
