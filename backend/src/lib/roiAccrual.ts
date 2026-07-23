import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { investments, projects, payouts } from "../db/schema.js";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Accrues each active investment's daily share of its package's target
 * return, smoothed evenly across the package duration.
 *
 * ROI is NOT auto-credited to the wallet. Each day's accrual is written as a
 * "scheduled" payout that the investor must claim from the investment detail
 * page (POST /api/investments/:id/claim-roi), which is what credits the
 * wallet. Any scheduled payout left unclaimed when the next day begins is
 * marked "forfeited" here and can no longer be claimed.
 * Idempotent per calendar day; stops once an investment matures.
 */
export async function runDailyRoiAccrual() {
  const today = startOfToday();

  // Expire yesterday's unclaimed ROI before accruing today's.
  const forfeited = await db
    .update(payouts)
    .set({ status: "forfeited" })
    .where(and(eq(payouts.status, "scheduled"), lt(payouts.scheduledFor, today)))
    .returning({ id: payouts.id });

  const activeInvestments = await db
    .select({
      id: investments.id,
      userId: investments.userId,
      amountGhs: investments.amountGhs,
      createdAt: investments.createdAt,
      projectId: investments.projectId,
      expectedReturnPct: projects.expectedReturnPct,
      durationDays: projects.durationDays,
      projectTitle: projects.title,
    })
    .from(investments)
    .innerJoin(projects, eq(projects.id, investments.projectId))
    .where(eq(investments.status, "active"));

  const accruedToday = await db
    .select({ investmentId: payouts.investmentId })
    .from(payouts)
    .where(gte(payouts.scheduledFor, today));
  const accruedSet = new Set(accruedToday.map((p) => p.investmentId));

  let accrued = 0;

  for (const inv of activeInvestments) {
    if (accruedSet.has(inv.id)) continue;

    const durationDays = Number(inv.durationDays);
    const maturity = addDays(new Date(inv.createdAt), durationDays);
    if (today >= maturity) continue;

    if (durationDays <= 0) continue;

    const amount = Number(inv.amountGhs);
    const totalReturn = amount * (Number(inv.expectedReturnPct) / 100);
    const dailyAmount = Math.round((totalReturn / durationDays) * 100) / 100;
    if (dailyAmount <= 0) continue;

    await db.insert(payouts).values({
      investmentId: inv.id,
      amountGhs: dailyAmount.toFixed(2),
      status: "scheduled",
      scheduledFor: today,
    });

    accrued++;
  }

  return {
    processed: activeInvestments.length,
    credited: accrued,
    forfeited: forfeited.length,
  };
}
