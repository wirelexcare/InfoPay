import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  referralRelationships,
  referralRewards,
  referralConfig,
  users,
  portfolios,
} from "../db/schema.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { getOrCreateReferralCode } from "../lib/referrals.js";

export const referralsRouter = Router();

referralsRouter.use(requireAuth);

referralsRouter.get("/code", async (req: AuthedRequest, res) => {
  try {
    const code = await getOrCreateReferralCode(req.user!.userId);
    res.json({ code });
  } catch (error) {
    console.error("Error generating referral code:", error);
    res.status(500).json({ error: "Failed to generate referral code" });
  }
});

referralsRouter.get("/config", async (_req: AuthedRequest, res) => {
  try {
    const rows = await db
      .select({
        level: referralConfig.level,
        rewardPercentage: referralConfig.rewardPercentage,
        isActive: referralConfig.isActive,
      })
      .from(referralConfig)
      .orderBy(referralConfig.level);

    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching referral config:", error);
    res.status(500).json({ error: "Failed to fetch referral config" });
  }
});

referralsRouter.get("/stats", async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.userId;

    const counts = await db
      .select({
        level: referralRelationships.level,
        count: sql<number>`count(*)`,
      })
      .from(referralRelationships)
      .where(eq(referralRelationships.referrerId, userId))
      .groupBy(referralRelationships.level);

    const earnings = await db
      .select({
        level: referralRewards.level,
        total: sql<string>`COALESCE(SUM(reward_amount_ghs), 0)`,
      })
      .from(referralRewards)
      .where(
        and(eq(referralRewards.referrerId, userId), eq(referralRewards.status, "credited")),
      )
      .groupBy(referralRewards.level);

    const countByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const c of counts) countByLevel[c.level] = Number(c.count);

    const earningsByLevel: Record<number, string> = { 1: "0.00", 2: "0.00", 3: "0.00" };
    for (const e of earnings) earningsByLevel[e.level] = Number(e.total).toFixed(2);

    const totalEarnings =
      Number(earningsByLevel[1]) + Number(earningsByLevel[2]) + Number(earningsByLevel[3]);

    res.json({
      level1Count: countByLevel[1],
      level2Count: countByLevel[2],
      level3Count: countByLevel[3],
      level1EarningsGhs: earningsByLevel[1],
      level2EarningsGhs: earningsByLevel[2],
      level3EarningsGhs: earningsByLevel[3],
      totalEarningsGhs: totalEarnings.toFixed(2),
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    res.status(500).json({ error: "Failed to fetch referral stats" });
  }
});

referralsRouter.get("/referees", async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const level = req.query.level ? Number(req.query.level) : 1;

    const rows = await db
      .select({
        userId: users.id,
        fullName: users.fullName,
        phone: users.phone,
        referredAt: referralRelationships.createdAt,
        totalInvestedGhs: portfolios.totalInvestedGhs,
      })
      .from(referralRelationships)
      .innerJoin(users, eq(users.id, referralRelationships.refereeId))
      .leftJoin(portfolios, eq(portfolios.userId, referralRelationships.refereeId))
      .where(
        and(eq(referralRelationships.referrerId, userId), eq(referralRelationships.level, level)),
      )
      .orderBy(desc(referralRelationships.createdAt));

    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching referees:", error);
    res.status(500).json({ error: "Failed to fetch referees" });
  }
});

referralsRouter.get("/rewards", async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: referralRewards.id,
        level: referralRewards.level,
        investmentAmountGhs: referralRewards.investmentAmountGhs,
        rewardPercentage: referralRewards.rewardPercentage,
        rewardAmountGhs: referralRewards.rewardAmountGhs,
        status: referralRewards.status,
        createdAt: referralRewards.createdAt,
        refereePhone: users.phone,
        refereeFullName: users.fullName,
      })
      .from(referralRewards)
      .innerJoin(users, eq(users.id, referralRewards.refereeId))
      .where(eq(referralRewards.referrerId, userId))
      .orderBy(desc(referralRewards.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, userId));

    res.json({ data: rows, total: countResult[0]?.count || 0, page, limit });
  } catch (error) {
    console.error("Error fetching referral rewards:", error);
    res.status(500).json({ error: "Failed to fetch referral rewards" });
  }
});
