import { eq, gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  investments,
  projects,
  payouts,
  wallets,
  walletTransactions,
  portfolios,
} from "../db/schema.js";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Credits each active investment's daily share of its package's target
 * return, smoothed evenly across the package duration. This is funded from
 * InfoPay's reserve/treasury rather than tied to a specific realized
 * transaction per package — that's a deliberate business decision to pay
 * a smooth return regardless of the lumpiness of underlying operations.
 * Idempotent per calendar day; stops once an investment matures.
 */
export async function runDailyRoiAccrual() {
  const activeInvestments = await db
    .select({
      id: investments.id,
      userId: investments.userId,
      amountGhs: investments.amountGhs,
      createdAt: investments.createdAt,
      projectId: investments.projectId,
      expectedReturnPct: projects.expectedReturnPct,
      durationMonths: projects.durationMonths,
      projectTitle: projects.title,
    })
    .from(investments)
    .innerJoin(projects, eq(projects.id, investments.projectId))
    .where(eq(investments.status, "active"));

  const today = startOfToday();

  const creditedToday = await db
    .select({ investmentId: payouts.investmentId })
    .from(payouts)
    .where(gte(payouts.createdAt, today));
  const creditedSet = new Set(creditedToday.map((p) => p.investmentId));

  let credited = 0;

  for (const inv of activeInvestments) {
    if (creditedSet.has(inv.id)) continue;

    const maturity = addMonths(new Date(inv.createdAt), Number(inv.durationMonths));
    if (today >= maturity) continue;

    const durationDays = Number(inv.durationMonths) * 30;
    if (durationDays <= 0) continue;

    const amount = Number(inv.amountGhs);
    const totalReturn = amount * (Number(inv.expectedReturnPct) / 100);
    const dailyAmount = Math.round((totalReturn / durationDays) * 100) / 100;
    if (dailyAmount <= 0) continue;

    await db.insert(payouts).values({
      investmentId: inv.id,
      amountGhs: dailyAmount.toFixed(2),
      status: "paid",
      scheduledFor: today,
      paidAt: new Date(),
    });

    const [inserted] = await db
      .insert(wallets)
      .values({ userId: inv.userId })
      .onConflictDoNothing()
      .returning();
    const [wallet] =
      inserted !== undefined
        ? [inserted]
        : await db
            .select()
            .from(wallets)
            .where(eq(wallets.userId, inv.userId))
            .limit(1);

    const balanceBefore = Number(wallet.balanceGhs);
    const balanceAfter = balanceBefore + dailyAmount;

    await db
      .update(wallets)
      .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
      .where(eq(wallets.userId, inv.userId));

    await db.insert(walletTransactions).values({
      userId: inv.userId,
      type: "payout",
      amountGhs: dailyAmount.toFixed(2),
      balanceBeforeGhs: balanceBefore.toFixed(2),
      balanceAfterGhs: balanceAfter.toFixed(2),
      status: "completed",
      description: `ROI from ${inv.projectTitle}`,
    });

    await db
      .update(portfolios)
      .set({
        totalReturnsGhs: sql`${portfolios.totalReturnsGhs} + ${dailyAmount.toFixed(2)}`,
        updatedAt: new Date(),
      })
      .where(eq(portfolios.userId, inv.userId));

    credited++;
  }

  return { processed: activeInvestments.length, credited };
}
