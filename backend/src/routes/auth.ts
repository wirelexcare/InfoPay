import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
} from "../lib/auth.js";
import { applyReferralCode } from "../lib/referrals.js";

export const authRouter = Router();

const AFRICAN_COUNTRY_CURRENCY: Record<string, string> = {
  GH: "GHS",
  NG: "NGN",
  KE: "KES",
  ZA: "ZAR",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  CI: "XOF",
  SN: "XOF",
  ET: "ETB",
  EG: "EGP",
  MA: "MAD",
  ZM: "ZMW",
  ZW: "ZWL",
  CM: "XAF",
  GM: "GMD",
  SL: "SLL",
  LR: "LRD",
};

const signupSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(8),
  fullName: z.string().min(2),
  country: z.string().length(2),
  referralCode: z.string().trim().max(12).optional(),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { phone, password, fullName, country, referralCode } = parsed.data;
  const countryCode = country.toUpperCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Phone number already registered" });
  }

  const passwordHash = await hashPassword(password);
  const preferredCurrency = AFRICAN_COUNTRY_CURRENCY[countryCode] ?? "GHS";

  const [user] = await db
    .insert(users)
    .values({
      phone,
      passwordHash,
      fullName,
      country: countryCode,
      preferredCurrency,
    })
    .returning({
      id: users.id,
      phone: users.phone,
      fullName: users.fullName,
      country: users.country,
      preferredCurrency: users.preferredCurrency,
      role: users.role,
      kycStatus: users.kycStatus,
    });

  if (referralCode) {
    await applyReferralCode(user.id, referralCode).catch((err) =>
      console.error("Failed to apply referral code:", err),
    );
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

  res.status(201).json({ user, accessToken, refreshToken });
});

const loginSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string(),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { phone, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid phone number or password" });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: "This account has been suspended" });
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

  res.json({
    user: {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      country: user.country,
      preferredCurrency: user.preferredCurrency,
      role: user.role,
      kycStatus: user.kycStatus,
    },
    accessToken,
    refreshToken,
  });
});
