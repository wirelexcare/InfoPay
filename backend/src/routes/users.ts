import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, portfolios } from "../db/schema.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const [user] = await db
    .select({
      id: users.id,
      phone: users.phone,
      fullName: users.fullName,
      country: users.country,
      preferredCurrency: users.preferredCurrency,
      role: users.role,
      kycStatus: users.kycStatus,
    })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user });
});

const updateCurrencySchema = z.object({
  preferredCurrency: z.string().length(3),
});

usersRouter.patch(
  "/me/currency",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = updateCurrencySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const [user] = await db
      .update(users)
      .set({
        preferredCurrency: parsed.data.preferredCurrency.toUpperCase(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user!.userId))
      .returning({
        id: users.id,
        preferredCurrency: users.preferredCurrency,
      });
    res.json({ user });
  },
);

usersRouter.get("/me/portfolio", requireAuth, async (req: AuthedRequest, res) => {
  const [portfolio] = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, req.user!.userId))
    .limit(1);
  res.json({
    portfolio: portfolio ?? {
      totalInvestedGhs: "0",
      totalReturnsGhs: "0",
    },
  });
});
