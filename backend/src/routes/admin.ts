import { Router } from "express";
import multer from "multer";
import { eq, gt, gte, and, asc, desc, sql, or, ilike, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  users,
  kycVerifications,
  projects,
  investments,
  wallets,
  walletTransactions,
  cryptoPayments,
  auditLogs,
  adminPermissions,
  withdrawalMethods,
  payouts,
  portfolios,
  referralConfig,
  referralRewards,
  depositSettings,
  depositMethodSettings,
  manualDeposits,
  rewardPools,
  rewardClaims,
  rewardPoolAudit,
  announcements,
  supportSettings,
  paymentSettings,
  chatMessages,
} from "../db/schema.js";
import {
  requireAuth,
  requireAdmin,
  requirePermission,
  FULL_ACCESS_PERMISSION,
  ADMIN_SCOPES,
  type AuthedRequest,
} from "../middleware/auth.js";
import { runDailyRoiAccrual } from "../lib/roiAccrual.js";
import { uploadProjectImage, uploadPaymentScreenshot } from "../lib/storage.js";
import { generateRewardPoolCode } from "../lib/rewardPoolCode.js";
import { getPaymentRules } from "../lib/paymentSettings.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

export const adminRouter = Router();

// Apply auth and admin checks to all routes
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

// Never leak passwordHash to the admin frontend
const SAFE_USER_COLUMNS = {
  id: users.id,
  phone: users.phone,
  fullName: users.fullName,
  country: users.country,
  preferredCurrency: users.preferredCurrency,
  role: users.role,
  kycStatus: users.kycStatus,
  isSuspended: users.isSuspended,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

// Audit log helper
async function logAdminAction(
  adminId: string,
  action: string,
  resource: string,
  resourceId: string,
  metadata?: Record<string, any>,
) {
  await db.insert(auditLogs).values({
    userId: adminId,
    action,
    resource,
    resourceId,
    metadata,
  });
}

// ============ USERS ============

adminRouter.get("/users", requirePermission("users.manage"), async (req: AuthedRequest, res) => {
  try {
    const search = (req.query.search as string) || "";
    const kycStatus = (req.query.kycStatus as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(users.phone, searchPattern),
          ilike(users.fullName, searchPattern),
        ),
      );
    }

    if (kycStatus) {
      conditions.push(eq(users.kycStatus, kycStatus as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const query = whereClause
      ? db.select(SAFE_USER_COLUMNS).from(users).where(whereClause)
      : db.select(SAFE_USER_COLUMNS).from(users);

    const data = await query.limit(limit).offset(offset);
    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(users);
    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminRouter.get("/users/:userId", requirePermission("users.manage"), async (req: AuthedRequest, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db
      .select(SAFE_USER_COLUMNS)
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [kyc] = await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.userId, userId));

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId));

    const investments_data = await db
      .select()
      .from(investments)
      .where(eq(investments.userId, userId));

    const txns = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(10);

    const permissionRows =
      user.role === "admin"
        ? await db
            .select({ permission: adminPermissions.permission })
            .from(adminPermissions)
            .where(eq(adminPermissions.adminId, userId))
        : [];
    const permissions = permissionRows.map((r) => r.permission);

    res.json({
      user,
      kyc,
      wallet,
      investments: investments_data,
      recentTxns: txns,
      permissions,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

adminRouter.post("/users/:userId/suspend", requirePermission("users.manage"), async (req: AuthedRequest, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (userId === req.user!.userId) {
      return res.status(400).json({ error: "You cannot suspend yourself" });
    }

    // Never let one admin suspend another admin (and lock out the platform);
    // an admin must be demoted before they can be suspended.
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }
    if (target.role === "admin") {
      return res
        .status(400)
        .json({ error: "Demote this admin before suspending them" });
    }

    await db
      .update(users)
      .set({ isSuspended: true })
      .where(eq(users.id, userId));

    await logAdminAction(
      req.user!.userId,
      "SUSPEND_USER",
      "users",
      userId,
      { reason },
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error suspending user:", error);
    res.status(500).json({ error: "Failed to suspend user" });
  }
});

adminRouter.post("/users/:userId/activate", requirePermission("users.manage"), async (req: AuthedRequest, res) => {
  try {
    const { userId } = req.params;

    await db
      .update(users)
      .set({ isSuspended: false })
      .where(eq(users.id, userId));

    await logAdminAction(req.user!.userId, "ACTIVATE_USER", "users", userId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error activating user:", error);
    res.status(500).json({ error: "Failed to activate user" });
  }
});

const walletAdjustmentSchema = z.object({
  direction: z.enum(["credit", "debit"]),
  amountGhs: z.coerce.number().positive(),
  reason: z.string().trim().min(3).max(200),
});

adminRouter.post(
  "/users/:userId/wallet-adjustment",
  requirePermission("users.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { userId } = req.params;
      const parsed = walletAdjustmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { direction, amountGhs, reason } = parsed.data;

      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      // Ensure a wallet row exists, then read the current balance.
      const [inserted] = await db
        .insert(wallets)
        .values({ userId })
        .onConflictDoNothing()
        .returning();
      const [wallet] =
        inserted !== undefined
          ? [inserted]
          : await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);

      const balanceBefore = Number(wallet.balanceGhs);
      const delta = direction === "credit" ? amountGhs : -amountGhs;
      const balanceAfter = balanceBefore + delta;

      if (balanceAfter < 0) {
        return res.status(400).json({
          error: `Insufficient balance. Available: ₵${balanceBefore.toFixed(2)}`,
        });
      }

      await db
        .update(wallets)
        .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
        .where(eq(wallets.userId, userId));

      await db.insert(walletTransactions).values({
        userId,
        type: direction === "credit" ? "adjustment_credit" : "adjustment_debit",
        amountGhs: amountGhs.toFixed(2),
        balanceBeforeGhs: balanceBefore.toFixed(2),
        balanceAfterGhs: balanceAfter.toFixed(2),
        status: "completed",
        method: "adjustment",
        description: `Admin ${direction} — ${reason}`,
      });

      await logAdminAction(
        req.user!.userId,
        direction === "credit" ? "WALLET_CREDIT" : "WALLET_DEBIT",
        "wallets",
        userId,
        { amountGhs, reason, balanceBefore, balanceAfter },
      );

      res.json({ success: true, balanceBefore, balanceAfter });
    } catch (error) {
      console.error("Error adjusting wallet:", error);
      res.status(500).json({ error: "Failed to adjust wallet" });
    }
  },
);

adminRouter.get("/permissions/scopes", requirePermission("admins.manage"), async (_req, res) => {
  res.json({ scopes: ADMIN_SCOPES });
});

const promoteSchema = z.object({
  level: z.enum(["full", "limited"]),
  permissions: z.array(z.enum(ADMIN_SCOPES)).optional(),
});

adminRouter.post(
  "/users/:userId/promote",
  requirePermission("admins.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { userId } = req.params;
      const parsed = promoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { level, permissions } = parsed.data;

      if (userId === req.user!.userId) {
        return res.status(400).json({
          error: "You cannot change your own admin access",
        });
      }

      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));

      // Reset existing grants, then re-grant based on the chosen level
      await db.delete(adminPermissions).where(eq(adminPermissions.adminId, userId));

      if (level === "full") {
        await db
          .insert(adminPermissions)
          .values({ adminId: userId, permission: FULL_ACCESS_PERMISSION });
      } else {
        const scopes = permissions ?? [];
        if (scopes.length > 0) {
          await db
            .insert(adminPermissions)
            .values(scopes.map((permission) => ({ adminId: userId, permission })));
        }
      }

      await logAdminAction(req.user!.userId, "PROMOTE_USER", "users", userId, {
        level,
        permissions,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error promoting user:", error);
      res.status(500).json({ error: "Failed to promote user" });
    }
  },
);

adminRouter.post(
  "/users/:userId/demote",
  requirePermission("admins.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { userId } = req.params;

      if (userId === req.user!.userId) {
        return res.status(400).json({ error: "You cannot demote yourself" });
      }

      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      await db.update(users).set({ role: "investor" }).where(eq(users.id, userId));
      await db.delete(adminPermissions).where(eq(adminPermissions.adminId, userId));

      await logAdminAction(req.user!.userId, "DEMOTE_USER", "users", userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error demoting user:", error);
      res.status(500).json({ error: "Failed to demote user" });
    }
  },
);

// ============ KYC ============

adminRouter.get("/kyc/pending", requirePermission("kyc.manage"), async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const data = await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.status, "pending"))
      .orderBy(desc(kycVerifications.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(kycVerifications)
      .where(eq(kycVerifications.status, "pending"));
    const total = countResult[0]?.count || 0;

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching pending KYC:", error);
    res.status(500).json({ error: "Failed to fetch pending KYC" });
  }
});

adminRouter.post("/kyc/:kycId/approve", requirePermission("kyc.manage"), async (req: AuthedRequest, res) => {
  try {
    const { kycId } = req.params;

    const [kyc] = await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.id, kycId));

    if (!kyc) {
      return res.status(404).json({ error: "KYC not found" });
    }

    await db
      .update(kycVerifications)
      .set({ status: "verified", reviewedAt: new Date() })
      .where(eq(kycVerifications.id, kycId));

    await db
      .update(users)
      .set({ kycStatus: "verified" })
      .where(eq(users.id, kyc.userId));

    await logAdminAction(req.user!.userId, "APPROVE_KYC", "kyc_verifications", kycId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error approving KYC:", error);
    res.status(500).json({ error: "Failed to approve KYC" });
  }
});

adminRouter.post("/kyc/:kycId/reject", requirePermission("kyc.manage"), async (req: AuthedRequest, res) => {
  try {
    const { kycId } = req.params;
    const { reason } = req.body;

    const [kyc] = await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.id, kycId));

    if (!kyc) {
      return res.status(404).json({ error: "KYC not found" });
    }

    await db
      .update(kycVerifications)
      .set({ status: "rejected", reviewedAt: new Date() })
      .where(eq(kycVerifications.id, kycId));

    await db
      .update(users)
      .set({ kycStatus: "rejected" })
      .where(eq(users.id, kyc.userId));

    await logAdminAction(req.user!.userId, "REJECT_KYC", "kyc_verifications", kycId, {
      reason,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error rejecting KYC:", error);
    res.status(500).json({ error: "Failed to reject KYC" });
  }
});

// ============ PROJECTS ============

adminRouter.get("/projects", async (req: AuthedRequest, res) => {
  try {
    const isActive = req.query.active !== "false";
    const search = (req.query.search as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(projects.isActive, isActive)];
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(ilike(projects.title, searchPattern), ilike(projects.location, searchPattern))!,
      );
    }
    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(projects)
      .where(whereClause)
      .orderBy(asc(projects.minInvestmentGhs))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

adminRouter.get("/projects/:projectId", async (req: AuthedRequest, res) => {
  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, req.params.projectId));

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ data: project });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// Empty strings arrive from optional form fields the UI no longer shows;
// treat them as absent instead of failing number coercion.
const emptyToUndefined = (v: unknown) => (v === "" || v == null ? undefined : v);
const optionalPositiveNumber = z.preprocess(emptyToUndefined, z.coerce.number().positive().optional());

const projectFieldsSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().default(""),
  location: z.string().optional().default(""),
  targetAmountGhs: optionalPositiveNumber,
  minInvestmentGhs: z.coerce.number().positive(),
  maxInvestmentGhs: optionalPositiveNumber,
  expectedReturnPct: z.coerce.number().positive(),
  durationDays: z.coerce.number().int().positive(),
  imageUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

adminRouter.post("/projects", requirePermission("projects.manage"), async (req: AuthedRequest, res) => {
  try {
    const parsed = projectFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { data } = parsed;
    const [project] = await db
      .insert(projects)
      .values({
        title: data.title,
        description: data.description,
        location: data.location,
        targetAmountGhs: (data.targetAmountGhs ?? data.minInvestmentGhs).toString(),
        minInvestmentGhs: data.minInvestmentGhs.toString(),
        maxInvestmentGhs: data.maxInvestmentGhs?.toString(),
        expectedReturnPct: data.expectedReturnPct.toString(),
        durationDays: data.durationDays.toString(),
        imageUrl: data.imageUrl,
      })
      .returning();

    await logAdminAction(req.user!.userId, "CREATE_PROJECT", "projects", project.id);

    res.json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

adminRouter.patch("/projects/:projectId", requirePermission("projects.manage"), async (req: AuthedRequest, res) => {
  try {
    const { projectId } = req.params;
    const parsed = projectFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { data } = parsed;

    const [project] = await db
      .update(projects)
      .set({
        title: data.title,
        description: data.description,
        location: data.location,
        targetAmountGhs: (data.targetAmountGhs ?? data.minInvestmentGhs).toString(),
        minInvestmentGhs: data.minInvestmentGhs.toString(),
        maxInvestmentGhs: data.maxInvestmentGhs?.toString() ?? null,
        expectedReturnPct: data.expectedReturnPct.toString(),
        durationDays: data.durationDays.toString(),
        imageUrl: data.imageUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    await logAdminAction(req.user!.userId, "UPDATE_PROJECT", "projects", projectId, {
      updates: data,
    });

    res.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

const fundingStatusSchema = z.object({
  status: z.enum(["open", "target_reached", "stopped"]),
});

adminRouter.post(
  "/projects/:projectId/funding-status",
  requirePermission("projects.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { projectId } = req.params;
      const parsed = fundingStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const [project] = await db
        .update(projects)
        .set({ fundingStatus: parsed.data.status, updatedAt: new Date() })
        .where(eq(projects.id, projectId))
        .returning();

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      await logAdminAction(
        req.user!.userId,
        "SET_FUNDING_STATUS",
        "projects",
        projectId,
        { status: parsed.data.status },
      );

      res.json(project);
    } catch (error) {
      console.error("Error updating funding status:", error);
      res.status(500).json({ error: "Failed to update funding status" });
    }
  },
);

adminRouter.post(
  "/uploads/image",
  requirePermission("projects.manage"),
  upload.single("image"),
  async (req: AuthedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      const url = await uploadProjectImage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
      res.json({ url });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
);

// ============ PACKAGES (Alias for PROJECTS) ============
// Routes for /packages use the same handlers as /projects for investment packages

adminRouter.get("/packages", async (req: AuthedRequest, res) => {
  try {
    const isActive = req.query.active !== "false";
    const search = (req.query.search as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(projects.isActive, isActive)];
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(ilike(projects.title, searchPattern), ilike(projects.location, searchPattern))!,
      );
    }
    const whereClause = and(...conditions);

    const data = await db
      .select()
      .from(projects)
      .where(whereClause)
      .orderBy(asc(projects.minInvestmentGhs))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching packages:", error);
    res.status(500).json({ error: "Failed to fetch packages" });
  }
});

adminRouter.get("/packages/:packageId", async (req: AuthedRequest, res) => {
  try {
    const [package_] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, req.params.packageId));

    if (!package_) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json({ data: package_ });
  } catch (error) {
    console.error("Error fetching package:", error);
    res.status(500).json({ error: "Failed to fetch package" });
  }
});

adminRouter.post("/packages", requirePermission("projects.manage"), async (req: AuthedRequest, res) => {
  try {
    const parsed = projectFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { data } = parsed;
    const [package_] = await db
      .insert(projects)
      .values({
        title: data.title,
        description: data.description,
        location: data.location,
        targetAmountGhs: (data.targetAmountGhs ?? data.minInvestmentGhs).toString(),
        minInvestmentGhs: data.minInvestmentGhs.toString(),
        maxInvestmentGhs: data.maxInvestmentGhs?.toString(),
        expectedReturnPct: data.expectedReturnPct.toString(),
        durationDays: data.durationDays.toString(),
        imageUrl: data.imageUrl,
      })
      .returning();

    await logAdminAction(req.user!.userId, "CREATE_PACKAGE", "packages", package_.id);

    res.json(package_);
  } catch (error: any) {
    console.error("Error creating package:", error);
    res.status(500).json({ error: error.message || "Failed to create package" });
  }
});

adminRouter.patch("/packages/:packageId", requirePermission("projects.manage"), async (req: AuthedRequest, res) => {
  try {
    const parsed = projectFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { data } = parsed;
    const [package_] = await db
      .update(projects)
      .set({
        title: data.title,
        description: data.description,
        location: data.location,
        targetAmountGhs: (data.targetAmountGhs ?? data.minInvestmentGhs).toString(),
        minInvestmentGhs: data.minInvestmentGhs.toString(),
        maxInvestmentGhs: data.maxInvestmentGhs?.toString(),
        expectedReturnPct: data.expectedReturnPct.toString(),
        durationDays: data.durationDays.toString(),
        imageUrl: data.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, req.params.packageId))
      .returning();

    if (!package_) {
      return res.status(404).json({ error: "Package not found" });
    }

    await logAdminAction(req.user!.userId, "UPDATE_PACKAGE", "packages", package_.id);

    res.json(package_);
  } catch (error: any) {
    console.error("Error updating package:", error);
    res.status(500).json({ error: error.message || "Failed to update package" });
  }
});

const packageActiveSchema = z.object({ isActive: z.boolean() });

adminRouter.post("/packages/:packageId/active", requirePermission("projects.manage"), async (req: AuthedRequest, res) => {
  try {
    const parsed = packageActiveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const [package_] = await db
      .update(projects)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(eq(projects.id, req.params.packageId))
      .returning();

    if (!package_) {
      return res.status(404).json({ error: "Package not found" });
    }

    await logAdminAction(
      req.user!.userId,
      parsed.data.isActive ? "ACTIVATE_PACKAGE" : "DEACTIVATE_PACKAGE",
      "packages",
      package_.id,
    );

    res.json(package_);
  } catch (error: any) {
    console.error("Error updating package status:", error);
    res.status(500).json({ error: error.message || "Failed to update package status" });
  }
});

// ============ FINANCIALS ============

adminRouter.get("/financials/dashboard", requirePermission("payments.manage"), async (req: AuthedRequest, res) => {
  try {
    const investedResult = await db
      .select({
        total: sql<string>`SUM(amount_ghs)`,
      })
      .from(investments);

    const paidOutResult = await db
      .select({ total: sql<string>`SUM(amount_ghs)` })
      .from(walletTransactions)
      .where(eq(walletTransactions.type, "payout"));

    const depositedResult = await db
      .select({ total: sql<string>`SUM(balance_after_ghs)` })
      .from(walletTransactions)
      .where(eq(walletTransactions.type, "deposit"));

    const dailyPayouts = await db
      .select({ count: sql<number>`count(*)`, total: sql<string>`SUM(amount_ghs)` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.type, "payout"),
          gte(
            walletTransactions.createdAt,
            sql`NOW() - INTERVAL '1 day'`,
          ),
        ),
      );

    const withdrawnResult = await db
      .select({ total: sql<string>`SUM(amount_ghs)` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.type, "withdrawal"),
          eq(walletTransactions.status, "completed"),
        ),
      );

    res.json({
      aum: investedResult[0]?.total || "0",
      totalDeposits: depositedResult[0]?.total || "0",
      totalPayouts: paidOutResult[0]?.total || "0",
      totalWithdrawals: withdrawnResult[0]?.total || "0",
      dailyPayoutsCount: dailyPayouts[0]?.count || 0,
      dailyPayoutsAmount: dailyPayouts[0]?.total || "0",
    });
  } catch (error) {
    console.error("Error fetching financial dashboard:", error);
    res.status(500).json({ error: "Failed to fetch financial data" });
  }
});

// ============ PAYMENTS & CRYPTO ============

adminRouter.get("/payments/crypto", requirePermission("payments.manage"), async (req: AuthedRequest, res) => {
  try {
    const status = (req.query.status as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;
    const whereClause = status ? eq(cryptoPayments.status, status) : undefined;

    const data = await db
      .select()
      .from(cryptoPayments)
      .where(whereClause)
      .orderBy(desc(cryptoPayments.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(cryptoPayments)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching crypto payments:", error);
    res.status(500).json({ error: "Failed to fetch crypto payments" });
  }
});

adminRouter.get("/payments/crypto/:paymentId", requirePermission("payments.manage"), async (req: AuthedRequest, res) => {
  try {
    const [payment] = await db
      .select()
      .from(cryptoPayments)
      .where(eq(cryptoPayments.id, req.params.paymentId));

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const [user] = await db
      .select(SAFE_USER_COLUMNS)
      .from(users)
      .where(eq(users.id, payment.userId));

    let project = null;
    if (payment.investmentId) {
      const [investment] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, payment.investmentId));
      if (investment) {
        const [proj] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, investment.projectId));
        project = proj ?? null;
      }
    }

    res.json({ data: { ...payment, user, project } });
  } catch (error) {
    console.error("Error fetching crypto payment:", error);
    res.status(500).json({ error: "Failed to fetch crypto payment" });
  }
});

// ============ WITHDRAWALS ============

adminRouter.get("/withdrawals/pending", requirePermission("withdrawals.manage"), async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const data = await db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.type, "withdrawal"),
          eq(walletTransactions.status, "pending"),
        ),
      )
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.type, "withdrawal"),
          eq(walletTransactions.status, "pending"),
        ),
      );
    const total = countResult[0]?.count || 0;

    const withUserDetails = await Promise.all(
      data.map(async (txn) => {
        const [user] = await db
          .select(SAFE_USER_COLUMNS)
          .from(users)
          .where(eq(users.id, txn.userId));
        const [withdrawalMethod] = await db
          .select()
          .from(withdrawalMethods)
          .where(eq(withdrawalMethods.userId, txn.userId));
        return { ...txn, user, withdrawalMethod };
      }),
    );

    res.json({ data: withUserDetails, total, page, limit });
  } catch (error) {
    console.error("Error fetching pending withdrawals:", error);
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

adminRouter.get("/withdrawals/:txnId", requirePermission("withdrawals.manage"), async (req: AuthedRequest, res) => {
  try {
    const [txn] = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.id, req.params.txnId));

    if (!txn) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }

    const [user] = await db
      .select(SAFE_USER_COLUMNS)
      .from(users)
      .where(eq(users.id, txn.userId));

    const [withdrawalMethod] = await db
      .select()
      .from(withdrawalMethods)
      .where(eq(withdrawalMethods.userId, txn.userId));

    res.json({ data: { ...txn, user, withdrawalMethod } });
  } catch (error) {
    console.error("Error fetching withdrawal:", error);
    res.status(500).json({ error: "Failed to fetch withdrawal" });
  }
});

adminRouter.post("/withdrawals/:txnId/approve", requirePermission("withdrawals.manage"), async (req: AuthedRequest, res) => {
  try {
    const { txnId } = req.params;

    const [txn] = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.id, txnId));

    if (!txn) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }

    await db
      .update(walletTransactions)
      .set({ status: "completed" })
      .where(eq(walletTransactions.id, txnId));

    await logAdminAction(req.user!.userId, "APPROVE_WITHDRAWAL", "wallet_transactions", txnId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({ error: "Failed to approve withdrawal" });
  }
});

adminRouter.post("/withdrawals/:txnId/reject", requirePermission("withdrawals.manage"), async (req: AuthedRequest, res) => {
  try {
    const { txnId } = req.params;
    const { reason } = req.body;

    const [txn] = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.id, txnId));

    if (!txn) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }

    await db
      .update(walletTransactions)
      .set({ status: "failed" })
      .where(eq(walletTransactions.id, txnId));

    // Refund to wallet
    const balance = parseFloat(txn.amountGhs.toString());
    await db
      .update(wallets)
      .set({ balanceGhs: sql`balance_ghs + ${balance}` })
      .where(eq(wallets.userId, txn.userId));

    await logAdminAction(req.user!.userId, "REJECT_WITHDRAWAL", "wallet_transactions", txnId, {
      reason,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({ error: "Failed to reject withdrawal" });
  }
});

// ============ ADMIN UTILITIES ============

adminRouter.post("/run-daily-roi", async (req: AuthedRequest, res) => {
  try {
    const secret = req.headers["x-cron-secret"];
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await runDailyRoiAccrual();
    await logAdminAction(
      req.user!.userId,
      "RUN_DAILY_ROI",
      "system",
      "roi_accrual",
      result,
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error running daily ROI:", error);
    res.status(500).json({ error: "Failed to run daily ROI" });
  }
});

adminRouter.get("/audit-logs", requirePermission("admins.manage"), async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const data = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs);
    const total = countResult[0]?.count || 0;

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// ============ ROI RECONCILIATION ============

function computeDailyAmount(
  amountGhs: string,
  expectedReturnPct: string,
  durationDays: string,
): number {
  const days = Number(durationDays);
  if (days <= 0) return 0;
  const totalReturn = Number(amountGhs) * (Number(expectedReturnPct) / 100);
  return Math.round((totalReturn / days) * 100) / 100;
}

function daysElapsedSince(createdAt: Date, capDays: number): number {
  const start = new Date(createdAt);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(0, Math.min(days, capDays));
}

adminRouter.get("/roi/investments", requirePermission("roi.manage"), async (req: AuthedRequest, res) => {
  try {
    const search = (req.query.search as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const conditions = [eq(investments.status, "active")];
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(users.phone, searchPattern),
          ilike(users.fullName, searchPattern),
          ilike(projects.title, searchPattern),
        )!,
      );
    }
    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: investments.id,
        userId: investments.userId,
        amountGhs: investments.amountGhs,
        status: investments.status,
        createdAt: investments.createdAt,
        projectId: projects.id,
        projectTitle: projects.title,
        expectedReturnPct: projects.expectedReturnPct,
        durationDays: projects.durationDays,
        userFullName: users.fullName,
        userPhone: users.phone,
      })
      .from(investments)
      .innerJoin(projects, eq(projects.id, investments.projectId))
      .innerJoin(users, eq(users.id, investments.userId))
      .where(whereClause)
      .orderBy(desc(investments.createdAt))
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      rows.map(async (inv) => {
        const durationDays = Number(inv.durationDays);
        const dailyAmount = computeDailyAmount(
          inv.amountGhs,
          inv.expectedReturnPct,
          inv.durationDays,
        );
        const daysElapsed = daysElapsedSince(inv.createdAt, durationDays);
        const expectedPaid = Math.round(dailyAmount * daysElapsed * 100) / 100;

        const paidResult = await db
          .select({ total: sql<string>`COALESCE(SUM(amount_ghs), 0)` })
          .from(payouts)
          .where(and(eq(payouts.investmentId, inv.id), eq(payouts.status, "paid")));
        const paidSoFar = Number(paidResult[0]?.total || 0);

        const discrepancy = Math.round((expectedPaid - paidSoFar) * 100) / 100;

        return {
          ...inv,
          dailyAmount,
          expectedPaid,
          paidSoFar,
          discrepancy,
        };
      }),
    );

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(investments)
      .innerJoin(projects, eq(projects.id, investments.projectId))
      .innerJoin(users, eq(users.id, investments.userId))
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    res.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching ROI reconciliation:", error);
    res.status(500).json({ error: "Failed to fetch ROI reconciliation" });
  }
});

adminRouter.get("/roi/investments/:investmentId", requirePermission("roi.manage"), async (req: AuthedRequest, res) => {
  try {
    const { investmentId } = req.params;

    const [inv] = await db
      .select({
        id: investments.id,
        userId: investments.userId,
        amountGhs: investments.amountGhs,
        status: investments.status,
        createdAt: investments.createdAt,
        projectId: projects.id,
        projectTitle: projects.title,
        expectedReturnPct: projects.expectedReturnPct,
        durationDays: projects.durationDays,
      })
      .from(investments)
      .innerJoin(projects, eq(projects.id, investments.projectId))
      .where(eq(investments.id, investmentId));

    if (!inv) {
      return res.status(404).json({ error: "Investment not found" });
    }

    const [user] = await db
      .select(SAFE_USER_COLUMNS)
      .from(users)
      .where(eq(users.id, inv.userId));

    const payoutHistory = await db
      .select()
      .from(payouts)
      .where(eq(payouts.investmentId, investmentId))
      .orderBy(desc(payouts.createdAt));

    const durationDays = Number(inv.durationDays);
    const dailyAmount = computeDailyAmount(
      inv.amountGhs,
      inv.expectedReturnPct,
      inv.durationDays,
    );
    const daysElapsed = daysElapsedSince(inv.createdAt, durationDays);
    const expectedPaid = Math.round(dailyAmount * daysElapsed * 100) / 100;
    const paidSoFar = payoutHistory
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amountGhs), 0);
    const discrepancy = Math.round((expectedPaid - paidSoFar) * 100) / 100;

    res.json({
      data: {
        ...inv,
        user,
        dailyAmount,
        expectedPaid,
        paidSoFar: Math.round(paidSoFar * 100) / 100,
        discrepancy,
        payoutHistory,
      },
    });
  } catch (error) {
    console.error("Error fetching investment ROI detail:", error);
    res.status(500).json({ error: "Failed to fetch investment ROI detail" });
  }
});

const roiAdjustSchema = z.object({
  amountGhs: z.coerce.number().refine((n) => n !== 0, "Amount cannot be zero"),
  reason: z.string().min(3, "A reason is required"),
});

adminRouter.post(
  "/roi/investments/:investmentId/adjust",
  requirePermission("roi.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { investmentId } = req.params;
      const parsed = roiAdjustSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { amountGhs, reason } = parsed.data;

      const [inv] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, investmentId));

      if (!inv) {
        return res.status(404).json({ error: "Investment not found" });
      }

      const [wallet] = await db
        .insert(wallets)
        .values({ userId: inv.userId })
        .onConflictDoNothing()
        .returning();
      const [currentWallet] =
        wallet !== undefined
          ? [wallet]
          : await db.select().from(wallets).where(eq(wallets.userId, inv.userId)).limit(1);

      const balanceBefore = Number(currentWallet.balanceGhs);
      const balanceAfter = balanceBefore + amountGhs;

      if (balanceAfter < 0) {
        return res.status(400).json({
          error: `This debit would take the wallet balance negative (current balance: ${balanceBefore.toFixed(2)} GHS)`,
        });
      }

      await db.insert(payouts).values({
        investmentId,
        amountGhs: amountGhs.toFixed(2),
        status: "paid",
        scheduledFor: new Date(),
        paidAt: new Date(),
        isManual: true,
        note: reason,
        adjustedBy: req.user!.userId,
      });

      await db
        .update(wallets)
        .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
        .where(eq(wallets.userId, inv.userId));

      await db.insert(walletTransactions).values({
        userId: inv.userId,
        type: "payout",
        amountGhs: amountGhs.toFixed(2),
        balanceBeforeGhs: balanceBefore.toFixed(2),
        balanceAfterGhs: balanceAfter.toFixed(2),
        status: "completed",
        description: `Manual ROI adjustment: ${reason}`,
      });

      await db
        .update(portfolios)
        .set({
          totalReturnsGhs: sql`${portfolios.totalReturnsGhs} + ${amountGhs.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(eq(portfolios.userId, inv.userId));

      await logAdminAction(
        req.user!.userId,
        "MANUAL_ROI_ADJUSTMENT",
        "investments",
        investmentId,
        { amountGhs, reason },
      );

      res.json({ success: true, balanceAfter });
    } catch (error) {
      console.error("Error applying manual ROI adjustment:", error);
      res.status(500).json({ error: "Failed to apply manual ROI adjustment" });
    }
  },
);

// ============ REFERRAL PROGRAM ============

adminRouter.get("/referral-config", requirePermission("referrals.manage"), async (_req: AuthedRequest, res) => {
  try {
    const rows = await db
      .select({
        level: referralConfig.level,
        rewardPercentage: referralConfig.rewardPercentage,
        isActive: referralConfig.isActive,
        updatedAt: referralConfig.updatedAt,
        updatedByPhone: users.phone,
      })
      .from(referralConfig)
      .leftJoin(users, eq(users.id, referralConfig.updatedBy))
      .orderBy(referralConfig.level);

    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching referral config:", error);
    res.status(500).json({ error: "Failed to fetch referral config" });
  }
});

const referralConfigSchema = z.object({
  level: z.number().int().min(1).max(3),
  rewardPercentage: z.coerce.number().min(0).max(100),
  isActive: z.boolean().optional(),
});

adminRouter.post(
  "/referral-config",
  requirePermission("referrals.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = referralConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { level, rewardPercentage, isActive } = parsed.data;

      const [updated] = await db
        .insert(referralConfig)
        .values({
          level,
          rewardPercentage: rewardPercentage.toFixed(2),
          isActive: isActive ?? true,
          updatedBy: req.user!.userId,
        })
        .onConflictDoUpdate({
          target: referralConfig.level,
          set: {
            rewardPercentage: rewardPercentage.toFixed(2),
            ...(isActive !== undefined && { isActive }),
            updatedBy: req.user!.userId,
            updatedAt: new Date(),
          },
        })
        .returning();

      await logAdminAction(
        req.user!.userId,
        "REFERRAL_CONFIG_UPDATED",
        "referral_config",
        String(level),
        { level, rewardPercentage, isActive },
      );

      res.json({ data: updated });
    } catch (error) {
      console.error("Error updating referral config:", error);
      res.status(500).json({ error: "Failed to update referral config" });
    }
  },
);

adminRouter.get("/referral-rewards", requirePermission("referrals.manage"), async (req: AuthedRequest, res) => {
  try {
    const search = (req.query.search as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const referrerUsers = alias(users, "referrer_users");
    const refereeUsers = alias(users, "referee_users");

    const whereClause = search
      ? or(
          ilike(referrerUsers.phone, `%${search}%`),
          ilike(refereeUsers.phone, `%${search}%`),
        )
      : undefined;

    const rows = await db
      .select({
        id: referralRewards.id,
        level: referralRewards.level,
        investmentAmountGhs: referralRewards.investmentAmountGhs,
        rewardPercentage: referralRewards.rewardPercentage,
        rewardAmountGhs: referralRewards.rewardAmountGhs,
        status: referralRewards.status,
        createdAt: referralRewards.createdAt,
        referrerPhone: referrerUsers.phone,
        refereePhone: refereeUsers.phone,
      })
      .from(referralRewards)
      .innerJoin(referrerUsers, eq(referrerUsers.id, referralRewards.referrerId))
      .innerJoin(refereeUsers, eq(refereeUsers.id, referralRewards.refereeId))
      .where(whereClause)
      .orderBy(desc(referralRewards.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(referralRewards)
      .innerJoin(referrerUsers, eq(referrerUsers.id, referralRewards.referrerId))
      .innerJoin(refereeUsers, eq(refereeUsers.id, referralRewards.refereeId))
      .where(whereClause);

    const summaryResult = await db
      .select({ total: sql<string>`COALESCE(SUM(reward_amount_ghs), 0)` })
      .from(referralRewards)
      .where(eq(referralRewards.status, "credited"));

    res.json({
      data: rows,
      total: countResult[0]?.count || 0,
      page,
      limit,
      totalRewardedGhs: Number(summaryResult[0]?.total || 0).toFixed(2),
    });
  } catch (error) {
    console.error("Error fetching referral rewards:", error);
    res.status(500).json({ error: "Failed to fetch referral rewards" });
  }
});

// ============ MANUAL DEPOSITS ============

adminRouter.get("/deposit-settings", requirePermission("deposits.manage"), async (_req: AuthedRequest, res) => {
  try {
    const [settings] = await db
      .select({
        network: depositSettings.network,
        accountName: depositSettings.accountName,
        accountNumber: depositSettings.accountNumber,
        updatedAt: depositSettings.updatedAt,
        updatedByPhone: users.phone,
      })
      .from(depositSettings)
      .leftJoin(users, eq(users.id, depositSettings.updatedBy))
      .where(eq(depositSettings.key, "momo"))
      .limit(1);

    res.json({ data: settings ?? null });
  } catch (error) {
    console.error("Error fetching deposit settings:", error);
    res.status(500).json({ error: "Failed to fetch deposit settings" });
  }
});

const depositSettingsSchema = z.object({
  network: z.enum(["mtn", "vodafone", "telecel", "airteltigo"]),
  accountName: z.string().min(2).max(255),
  accountNumber: z.string().min(7).max(30),
});

adminRouter.post(
  "/deposit-settings",
  requirePermission("deposits.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = depositSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const [updated] = await db
        .insert(depositSettings)
        .values({
          key: "momo",
          ...parsed.data,
          updatedBy: req.user!.userId,
        })
        .onConflictDoUpdate({
          target: depositSettings.key,
          set: {
            ...parsed.data,
            updatedBy: req.user!.userId,
            updatedAt: new Date(),
          },
        })
        .returning();

      await logAdminAction(
        req.user!.userId,
        "DEPOSIT_SETTINGS_UPDATED",
        "deposit_settings",
        "momo",
        parsed.data,
      );

      res.json({ data: updated });
    } catch (error) {
      console.error("Error updating deposit settings:", error);
      res.status(500).json({ error: "Failed to update deposit settings" });
    }
  },
);

// Which deposit methods users can see on the wallet Deposit tab.
adminRouter.get("/deposit-methods", requirePermission("deposits.manage"), async (_req: AuthedRequest, res) => {
  try {
    const [row] = await db.select().from(depositMethodSettings).limit(1);
    res.json({
      data: {
        momoEnabled: row?.momoEnabled ?? true,
        cryptoEnabled: row?.cryptoEnabled ?? true,
        chatEnabled: row?.chatEnabled ?? true,
      },
    });
  } catch (error) {
    console.error("Error fetching deposit methods:", error);
    res.status(500).json({ error: "Failed to fetch deposit methods" });
  }
});

const depositMethodsSchema = z.object({
  momoEnabled: z.boolean(),
  cryptoEnabled: z.boolean(),
  chatEnabled: z.boolean(),
});

adminRouter.put(
  "/deposit-methods",
  requirePermission("deposits.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = depositMethodsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const values = {
        ...parsed.data,
        updatedBy: req.user!.userId,
        updatedAt: new Date(),
      };

      const [existing] = await db
        .select({ id: depositMethodSettings.id })
        .from(depositMethodSettings)
        .limit(1);
      let row;
      if (existing) {
        [row] = await db
          .update(depositMethodSettings)
          .set(values)
          .where(eq(depositMethodSettings.id, existing.id))
          .returning();
      } else {
        [row] = await db.insert(depositMethodSettings).values(values).returning();
      }

      await logAdminAction(
        req.user!.userId,
        "DEPOSIT_METHODS_UPDATED",
        "deposit_method_settings",
        row.id,
        parsed.data,
      );

      res.json({ data: row });
    } catch (error) {
      console.error("Error updating deposit methods:", error);
      res.status(500).json({ error: "Failed to update deposit methods" });
    }
  },
);

adminRouter.get("/manual-deposits/pending", requirePermission("deposits.manage"), async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: manualDeposits.id,
        reference: manualDeposits.reference,
        amountGhs: manualDeposits.amountGhs,
        network: manualDeposits.network,
        senderName: manualDeposits.senderName,
        senderNumber: manualDeposits.senderNumber,
        createdAt: manualDeposits.createdAt,
        userPhone: users.phone,
        userFullName: users.fullName,
      })
      .from(manualDeposits)
      .innerJoin(users, eq(users.id, manualDeposits.userId))
      .where(eq(manualDeposits.status, "pending"))
      .orderBy(desc(manualDeposits.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(manualDeposits)
      .where(eq(manualDeposits.status, "pending"));

    res.json({ data: rows, total: countResult[0]?.count || 0, page, limit });
  } catch (error) {
    console.error("Error fetching pending manual deposits:", error);
    res.status(500).json({ error: "Failed to fetch pending manual deposits" });
  }
});

adminRouter.get("/manual-deposits/:depositId", requirePermission("deposits.manage"), async (req: AuthedRequest, res) => {
  try {
    const [deposit] = await db
      .select()
      .from(manualDeposits)
      .where(eq(manualDeposits.id, req.params.depositId))
      .limit(1);

    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    const [user] = await db
      .select(SAFE_USER_COLUMNS)
      .from(users)
      .where(eq(users.id, deposit.userId));

    // The user paid intended + fee (fee is charged on top), so show reviewers
    // the exact figure to expect on the payment screenshot.
    const { depositFeePct } = await getPaymentRules();
    const intended = Number(deposit.amountGhs);
    const expectedPaymentGhs =
      Math.round(intended * (1 + depositFeePct / 100) * 100) / 100;

    res.json({
      data: { ...deposit, user, depositFeePct, expectedPaymentGhs },
    });
  } catch (error) {
    console.error("Error fetching manual deposit:", error);
    res.status(500).json({ error: "Failed to fetch manual deposit" });
  }
});

adminRouter.post(
  "/manual-deposits/:depositId/approve",
  requirePermission("deposits.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { depositId } = req.params;
      const [deposit] = await db
        .select()
        .from(manualDeposits)
        .where(eq(manualDeposits.id, depositId));

      if (!deposit) {
        return res.status(404).json({ error: "Deposit not found" });
      }
      if (deposit.status !== "pending") {
        return res.status(400).json({ error: `Deposit is already ${deposit.status}` });
      }

      const [wallet] = await db
        .insert(wallets)
        .values({ userId: deposit.userId })
        .onConflictDoNothing()
        .returning();
      const [currentWallet] =
        wallet !== undefined
          ? [wallet]
          : await db.select().from(wallets).where(eq(wallets.userId, deposit.userId)).limit(1);

      const balanceBefore = Number(currentWallet.balanceGhs);
      // The deposit fee is charged on top (the user pays intended + fee), so
      // the full stored amount is exactly what gets credited.
      const amount = Number(deposit.amountGhs);
      const balanceAfter = balanceBefore + amount;

      await db
        .update(wallets)
        .set({ balanceGhs: balanceAfter.toFixed(2), updatedAt: new Date() })
        .where(eq(wallets.userId, deposit.userId));

      await db.insert(walletTransactions).values({
        userId: deposit.userId,
        type: "deposit",
        amountGhs: amount.toFixed(2),
        balanceBeforeGhs: balanceBefore.toFixed(2),
        balanceAfterGhs: balanceAfter.toFixed(2),
        status: "completed",
        method: "momo",
        reference: deposit.reference,
        description: `Manual mobile money deposit (${deposit.network})`,
      });

      await db
        .update(manualDeposits)
        .set({
          status: "approved",
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
        })
        .where(eq(manualDeposits.id, depositId));

      await logAdminAction(
        req.user!.userId,
        "APPROVE_MANUAL_DEPOSIT",
        "manual_deposits",
        depositId,
        { amountGhs: amount, reference: deposit.reference },
      );

      // Notify the user in their live chat thread
      await db.insert(chatMessages).values({
        userId: deposit.userId,
        senderRole: "system",
        manualDepositId: depositId,
        body: `Your deposit of GHS ${amount.toFixed(2)} (ref ${deposit.reference}) was approved and your wallet has been credited.`,
        readByAdmin: true,
      });

      res.json({ success: true, balanceAfter });
    } catch (error) {
      console.error("Error approving manual deposit:", error);
      res.status(500).json({ error: "Failed to approve manual deposit" });
    }
  },
);

const rejectDepositSchema = z.object({
  reason: z.string().min(3),
});

adminRouter.post(
  "/manual-deposits/:depositId/reject",
  requirePermission("deposits.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { depositId } = req.params;
      const parsed = rejectDepositSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const [deposit] = await db
        .select()
        .from(manualDeposits)
        .where(eq(manualDeposits.id, depositId));

      if (!deposit) {
        return res.status(404).json({ error: "Deposit not found" });
      }
      if (deposit.status !== "pending") {
        return res.status(400).json({ error: `Deposit is already ${deposit.status}` });
      }

      await db
        .update(manualDeposits)
        .set({
          status: "rejected",
          rejectionReason: parsed.data.reason,
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
        })
        .where(eq(manualDeposits.id, depositId));

      await logAdminAction(
        req.user!.userId,
        "REJECT_MANUAL_DEPOSIT",
        "manual_deposits",
        depositId,
        { reason: parsed.data.reason },
      );

      // Notify the user in their live chat thread
      await db.insert(chatMessages).values({
        userId: deposit.userId,
        senderRole: "system",
        manualDepositId: depositId,
        body: `Your deposit of GHS ${Number(deposit.amountGhs).toFixed(2)} (ref ${deposit.reference}) was rejected: ${parsed.data.reason}`,
        readByAdmin: true,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting manual deposit:", error);
      res.status(500).json({ error: "Failed to reject manual deposit" });
    }
  },
);

// ============ REWARD POOLS ============

const createRewardPoolSchema = z.object({
  totalPoolGhs: z.number().positive(),
  rewardType: z.enum(["fixed", "random_range"]),
  fixedAmountGhs: z.number().positive().optional(),
  minAmountGhs: z.number().positive().optional(),
  maxAmountGhs: z.number().positive().optional(),
  allowDuplicateClaims: z.boolean().optional().default(false),
  expiresAt: z.string().datetime().optional(),
});

adminRouter.post(
  "/rewards/pools",
  requirePermission("rewards.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = createRewardPoolSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const code = await generateRewardPoolCode();

      const [pool] = await db
        .insert(rewardPools)
        .values({
          code,
          totalPoolGhs: parsed.data.totalPoolGhs.toFixed(2),
          rewardType: parsed.data.rewardType,
          fixedAmountGhs:
            parsed.data.rewardType === "fixed"
              ? parsed.data.fixedAmountGhs!.toFixed(2)
              : null,
          minAmountGhs:
            parsed.data.rewardType === "random_range"
              ? parsed.data.minAmountGhs!.toFixed(2)
              : null,
          maxAmountGhs:
            parsed.data.rewardType === "random_range"
              ? parsed.data.maxAmountGhs!.toFixed(2)
              : null,
          allowDuplicateClaims: parsed.data.allowDuplicateClaims,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          createdBy: req.user!.userId,
        })
        .returning();

      await logAdminAction(
        req.user!.userId,
        "REWARD_POOL_CREATED",
        "reward_pools",
        pool.id,
        {
          code,
          totalPoolGhs: parsed.data.totalPoolGhs,
          rewardType: parsed.data.rewardType,
        },
      );

      res.json({ data: pool });
    } catch (error) {
      console.error("Error creating reward pool:", error);
      res.status(500).json({ error: "Failed to create reward pool" });
    }
  },
);

adminRouter.get(
  "/rewards/pools",
  requirePermission("rewards.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = 50;
      const offset = (page - 1) * limit;
      const status = (req.query.status as string) || "";

      const conditions: any[] = [];
      if (status) {
        conditions.push(eq(rewardPools.status, status as any));
      }

      const rows = await db
        .select({
          id: rewardPools.id,
          code: rewardPools.code,
          totalPoolGhs: rewardPools.totalPoolGhs,
          claimedPoolGhs: rewardPools.claimedPoolGhs,
          rewardType: rewardPools.rewardType,
          status: rewardPools.status,
          allowDuplicateClaims: rewardPools.allowDuplicateClaims,
          expiresAt: rewardPools.expiresAt,
          createdAt: rewardPools.createdAt,
        })
        .from(rewardPools)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(rewardPools.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(rewardPools)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const poolsWithStats = rows.map((pool) => {
        const claimed = Number(pool.claimedPoolGhs);
        const total = Number(pool.totalPoolGhs);
        return {
          ...pool,
          percentClaimed: total > 0 ? (claimed / total) * 100 : 0,
        };
      });

      res.json({
        data: poolsWithStats,
        total: countResult[0]?.count || 0,
        page,
        limit,
      });
    } catch (error) {
      console.error("Error fetching reward pools:", error);
      res.status(500).json({ error: "Failed to fetch reward pools" });
    }
  },
);

adminRouter.get(
  "/rewards/pools/:poolId",
  requirePermission("rewards.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const [pool] = await db
        .select()
        .from(rewardPools)
        .where(eq(rewardPools.id, req.params.poolId))
        .limit(1);

      if (!pool) {
        return res.status(404).json({ error: "Reward pool not found" });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = 50;
      const offset = (page - 1) * limit;

      const claims = await db
        .select({
          id: rewardClaims.id,
          userPhone: users.phone,
          userFullName: users.fullName,
          claimedAmountGhs: rewardClaims.claimedAmountGhs,
          claimedAt: rewardClaims.claimedAt,
        })
        .from(rewardClaims)
        .innerJoin(users, eq(users.id, rewardClaims.userId))
        .where(eq(rewardClaims.poolId, req.params.poolId))
        .orderBy(desc(rewardClaims.claimedAt))
        .limit(limit)
        .offset(offset);

      const claimCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(rewardClaims)
        .where(eq(rewardClaims.poolId, req.params.poolId));

      const percentClaimed = Number(pool.totalPoolGhs) > 0
        ? (Number(pool.claimedPoolGhs) / Number(pool.totalPoolGhs)) * 100
        : 0;

      res.json({
        data: {
          ...pool,
          percentClaimed,
          claims,
          claimCount: claimCount[0]?.count || 0,
          page,
          limit,
        },
      });
    } catch (error) {
      console.error("Error fetching reward pool detail:", error);
      res.status(500).json({ error: "Failed to fetch reward pool detail" });
    }
  },
);

const updateRewardPoolSchema = z.object({
  status: z.enum(["active", "exhausted", "expired", "paused"]).optional(),
  expiresAt: z.string().datetime().optional(),
});

adminRouter.patch(
  "/rewards/pools/:poolId",
  requirePermission("rewards.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = updateRewardPoolSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const [pool] = await db
        .select()
        .from(rewardPools)
        .where(eq(rewardPools.id, req.params.poolId))
        .limit(1);

      if (!pool) {
        return res.status(404).json({ error: "Reward pool not found" });
      }

      const updates: Record<string, any> = {};
      if (parsed.data.status) updates.status = parsed.data.status;
      if (parsed.data.expiresAt) updates.expiresAt = new Date(parsed.data.expiresAt);
      updates.updatedAt = new Date();

      const [updated] = await db
        .update(rewardPools)
        .set(updates)
        .where(eq(rewardPools.id, req.params.poolId))
        .returning();

      await logAdminAction(
        req.user!.userId,
        "REWARD_POOL_UPDATED",
        "reward_pools",
        req.params.poolId,
        { changes: parsed.data },
      );

      res.json({ data: updated });
    } catch (error) {
      console.error("Error updating reward pool:", error);
      res.status(500).json({ error: "Failed to update reward pool" });
    }
  },
);

// ============ ANNOUNCEMENTS ============

const createAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2),
  isActive: z.boolean().optional().default(false),
});

const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  body: z.string().trim().min(2).optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

adminRouter.get(
  "/announcements",
  requirePermission("announcements.manage"),
  async (_req: AuthedRequest, res) => {
    try {
      const rows = await db
        .select()
        .from(announcements)
        .orderBy(asc(announcements.sortOrder), asc(announcements.createdAt));
      res.json({ data: rows });
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  },
);

adminRouter.post(
  "/announcements",
  requirePermission("announcements.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = createAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      // New items go to the end of the current order.
      const [{ max }] = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(announcements);
      const [row] = await db
        .insert(announcements)
        .values({ ...parsed.data, sortOrder: Number(max) + 1 })
        .returning();
      await logAdminAction(req.user!.userId, "CREATE_ANNOUNCEMENT", "announcements", row.id);
      res.status(201).json({ data: row });
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  },
);

adminRouter.patch(
  "/announcements/:id",
  requirePermission("announcements.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = updateAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const [row] = await db
        .update(announcements)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(announcements.id, req.params.id))
        .returning();
      if (!row) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      await logAdminAction(req.user!.userId, "UPDATE_ANNOUNCEMENT", "announcements", row.id, parsed.data);
      res.json({ data: row });
    } catch (error) {
      console.error("Error updating announcement:", error);
      res.status(500).json({ error: "Failed to update announcement" });
    }
  },
);

adminRouter.post(
  "/announcements/reorder",
  requirePermission("announcements.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = reorderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      // Assign sortOrder by the given order of ids.
      await Promise.all(
        parsed.data.ids.map((id, index) =>
          db
            .update(announcements)
            .set({ sortOrder: index, updatedAt: new Date() })
            .where(eq(announcements.id, id)),
        ),
      );
      await logAdminAction(req.user!.userId, "REORDER_ANNOUNCEMENTS", "announcements", "");
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering announcements:", error);
      res.status(500).json({ error: "Failed to reorder announcements" });
    }
  },
);

adminRouter.delete(
  "/announcements/:id",
  requirePermission("announcements.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const [row] = await db
        .delete(announcements)
        .where(eq(announcements.id, req.params.id))
        .returning();
      if (!row) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      await logAdminAction(req.user!.userId, "DELETE_ANNOUNCEMENT", "announcements", req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  },
);

// ============ SUPPORT SETTINGS ============

const supportSettingsSchema = z.object({
  whatsappChannelUrl: z.string().trim().url().max(500).or(z.literal("")).optional(),
  telegramGroupUrl: z.string().trim().url().max(500).or(z.literal("")).optional(),
  telegramProfiles: z
    .array(
      z.object({
        label: z.string().trim().max(60).optional().default(""),
        url: z.string().trim().url().max(500),
      }),
    )
    .max(10)
    .optional()
    .default([]),
});

adminRouter.get(
  "/support-settings",
  requirePermission("support.manage"),
  async (_req: AuthedRequest, res) => {
    try {
      const [row] = await db.select().from(supportSettings).limit(1);
      res.json({
        data: row ?? {
          whatsappChannelUrl: "",
          telegramGroupUrl: "",
          telegramProfiles: [],
        },
      });
    } catch (error) {
      console.error("Error fetching support settings:", error);
      res.status(500).json({ error: "Failed to fetch support settings" });
    }
  },
);

adminRouter.put(
  "/support-settings",
  requirePermission("support.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = supportSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const values = {
        whatsappChannelUrl: parsed.data.whatsappChannelUrl?.trim() || null,
        telegramGroupUrl: parsed.data.telegramGroupUrl?.trim() || null,
        telegramProfiles: (parsed.data.telegramProfiles ?? []).map((p) => ({
          label: p.label?.trim() || "",
          url: p.url.trim(),
        })),
        updatedAt: new Date(),
      };

      const [existing] = await db.select({ id: supportSettings.id }).from(supportSettings).limit(1);
      let row;
      if (existing) {
        [row] = await db
          .update(supportSettings)
          .set(values)
          .where(eq(supportSettings.id, existing.id))
          .returning();
      } else {
        [row] = await db.insert(supportSettings).values(values).returning();
      }

      await logAdminAction(req.user!.userId, "UPDATE_SUPPORT_SETTINGS", "support_settings", row.id);
      res.json({ data: row });
    } catch (error) {
      console.error("Error updating support settings:", error);
      res.status(500).json({ error: "Failed to update support settings" });
    }
  },
);

// ============ LIVE CHATS ============

// Deposits linked to a user's chat, joined live so top-up cards always
// reflect the current review status.
async function getChatDepositsForUser(userId: string) {
  return db
    .select({
      id: manualDeposits.id,
      reference: manualDeposits.reference,
      amountGhs: manualDeposits.amountGhs,
      status: manualDeposits.status,
      rejectionReason: manualDeposits.rejectionReason,
      screenshotUrl: manualDeposits.screenshotUrl,
    })
    .from(manualDeposits)
    .where(eq(manualDeposits.userId, userId))
    .orderBy(desc(manualDeposits.createdAt))
    .limit(50);
}

adminRouter.get(
  "/chats",
  requirePermission("chats.manage"),
  async (_req: AuthedRequest, res) => {
    try {
      const convos = await db
        .select({
          userId: chatMessages.userId,
          lastMessageAt: sql<string>`max(${chatMessages.createdAt})`,
          unreadCount: sql<number>`count(*) filter (where ${chatMessages.senderRole} = 'user' and ${chatMessages.readByAdmin} = false)`,
        })
        .from(chatMessages)
        .groupBy(chatMessages.userId)
        .orderBy(sql`max(${chatMessages.createdAt}) desc`)
        .limit(100);

      if (convos.length === 0) {
        return res.json({ data: [] });
      }

      const userIds = convos.map((c) => c.userId);
      const [convoUsers, recentMessages] = await Promise.all([
        db
          .select({
            id: users.id,
            fullName: users.fullName,
            phone: users.phone,
          })
          .from(users)
          .where(inArray(users.id, userIds)),
        db
          .select()
          .from(chatMessages)
          .where(inArray(chatMessages.userId, userIds))
          .orderBy(desc(chatMessages.createdAt))
          .limit(300),
      ]);

      const userMap = new Map(convoUsers.map((u) => [u.id, u]));
      // First message per user in the desc-ordered list = latest message
      const latestByUser = new Map<string, (typeof recentMessages)[number]>();
      for (const msg of recentMessages) {
        if (!latestByUser.has(msg.userId)) latestByUser.set(msg.userId, msg);
      }

      const data = convos.map((c) => {
        const u = userMap.get(c.userId);
        const last = latestByUser.get(c.userId);
        let preview = last?.body ?? "";
        if (!preview && last?.imageUrl) preview = "Image";
        if (!preview && last?.manualDepositId) preview = "Top-up request";
        return {
          userId: c.userId,
          userFullName: u?.fullName ?? "Unknown",
          userPhone: u?.phone ?? "",
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: preview,
          unreadCount: Number(c.unreadCount),
        };
      });

      res.json({ data });
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ error: "Failed to fetch chats" });
    }
  },
);

adminRouter.get(
  "/chats/unread",
  requirePermission("chats.manage"),
  async (_req: AuthedRequest, res) => {
    try {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.senderRole, "user"),
            eq(chatMessages.readByAdmin, false),
          ),
        );
      res.json({ count: Number(row?.count ?? 0) });
    } catch (error) {
      console.error("Error fetching chat unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  },
);

adminRouter.get(
  "/chats/:userId/messages",
  requirePermission("chats.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { userId } = req.params;
      const after =
        typeof req.query.after === "string" ? new Date(req.query.after) : null;

      const conditions =
        after && !Number.isNaN(after.getTime())
          ? and(eq(chatMessages.userId, userId), gt(chatMessages.createdAt, after))
          : eq(chatMessages.userId, userId);

      const [messages, deposits, [user]] = await Promise.all([
        db
          .select()
          .from(chatMessages)
          .where(conditions)
          .orderBy(asc(chatMessages.createdAt))
          .limit(200),
        getChatDepositsForUser(userId),
        db
          .select({
            id: users.id,
            fullName: users.fullName,
            phone: users.phone,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
      ]);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ messages, deposits, user });
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  },
);

const adminSendMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    imageUrl: z.string().url().optional(),
  })
  .refine((data) => data.body || data.imageUrl, {
    message: "Message must have text or an image",
  });

adminRouter.post(
  "/chats/:userId/messages",
  requirePermission("chats.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const { userId } = req.params;
      const parsed = adminSendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const [message] = await db
        .insert(chatMessages)
        .values({
          userId,
          senderId: req.user!.userId,
          senderRole: "admin",
          body: parsed.data.body ?? null,
          imageUrl: parsed.data.imageUrl ?? null,
          readByAdmin: true,
        })
        .returning();

      await logAdminAction(
        req.user!.userId,
        "CHAT_MESSAGE_SENT",
        "chat_messages",
        message.id,
        { targetUserId: userId },
      );

      res.status(201).json({ message });
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  },
);

adminRouter.post(
  "/chats/:userId/read",
  requirePermission("chats.manage"),
  async (req: AuthedRequest, res) => {
    try {
      await db
        .update(chatMessages)
        .set({ readByAdmin: true })
        .where(
          and(
            eq(chatMessages.userId, req.params.userId),
            eq(chatMessages.readByAdmin, false),
          ),
        );
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking chat read:", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  },
);

adminRouter.post(
  "/chats/upload",
  requirePermission("chats.manage"),
  upload.single("image"),
  async (req: AuthedRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    try {
      const url = await uploadPaymentScreenshot(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
      res.json({ url });
    } catch (error) {
      console.error("Error uploading chat image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
);

// ============ PAYMENT SETTINGS (limits, fees, withdrawal windows) ============

const nullableAmount = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().nonnegative().nullable(),
);
const nullableTime = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
);

const paymentSettingsInputSchema = z
  .object({
    minDepositGhs: nullableAmount.optional().default(null),
    maxDepositGhs: nullableAmount.optional().default(null),
    minWithdrawalGhs: nullableAmount.optional().default(null),
    maxWithdrawalGhs: nullableAmount.optional().default(null),
    depositFeePct: z.coerce.number().min(0).max(100).optional().default(0),
    withdrawalFeePct: z.coerce.number().min(0).max(100).optional().default(0),
    withdrawalDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .max(7)
      .optional()
      .default([]),
    withdrawalStartTime: nullableTime.optional().default(null),
    withdrawalEndTime: nullableTime.optional().default(null),
  })
  .refine(
    (d) =>
      d.minDepositGhs == null || d.maxDepositGhs == null || d.maxDepositGhs >= d.minDepositGhs,
    { message: "Maximum deposit must be at least the minimum deposit" },
  )
  .refine(
    (d) =>
      d.minWithdrawalGhs == null ||
      d.maxWithdrawalGhs == null ||
      d.maxWithdrawalGhs >= d.minWithdrawalGhs,
    { message: "Maximum withdrawal must be at least the minimum withdrawal" },
  )
  .refine((d) => (d.withdrawalStartTime == null) === (d.withdrawalEndTime == null), {
    message: "Set both start and end time, or leave both blank for any time",
  });

adminRouter.get(
  "/payment-settings",
  requirePermission("payments.manage"),
  async (_req: AuthedRequest, res) => {
    try {
      const [row] = await db.select().from(paymentSettings).limit(1);
      res.json({
        data: row ?? {
          minDepositGhs: null,
          maxDepositGhs: null,
          minWithdrawalGhs: null,
          maxWithdrawalGhs: null,
          depositFeePct: "0",
          withdrawalFeePct: "0",
          withdrawalDays: [],
          withdrawalStartTime: null,
          withdrawalEndTime: null,
        },
      });
    } catch (error) {
      console.error("Error fetching payment settings:", error);
      res.status(500).json({ error: "Failed to fetch payment settings" });
    }
  },
);

adminRouter.put(
  "/payment-settings",
  requirePermission("payments.manage"),
  async (req: AuthedRequest, res) => {
    try {
      const parsed = paymentSettingsInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const d = parsed.data;
      const values = {
        minDepositGhs: d.minDepositGhs?.toFixed(2) ?? null,
        maxDepositGhs: d.maxDepositGhs?.toFixed(2) ?? null,
        minWithdrawalGhs: d.minWithdrawalGhs?.toFixed(2) ?? null,
        maxWithdrawalGhs: d.maxWithdrawalGhs?.toFixed(2) ?? null,
        depositFeePct: d.depositFeePct.toFixed(2),
        withdrawalFeePct: d.withdrawalFeePct.toFixed(2),
        withdrawalDays: [...new Set(d.withdrawalDays)].sort((a, b) => a - b),
        withdrawalStartTime: d.withdrawalStartTime,
        withdrawalEndTime: d.withdrawalEndTime,
        updatedAt: new Date(),
      };

      const [existing] = await db
        .select({ id: paymentSettings.id })
        .from(paymentSettings)
        .limit(1);
      let row;
      if (existing) {
        [row] = await db
          .update(paymentSettings)
          .set(values)
          .where(eq(paymentSettings.id, existing.id))
          .returning();
      } else {
        [row] = await db.insert(paymentSettings).values(values).returning();
      }

      await logAdminAction(
        req.user!.userId,
        "UPDATE_PAYMENT_SETTINGS",
        "payment_settings",
        row.id,
        values as Record<string, unknown>,
      );
      res.json({ data: row });
    } catch (error) {
      console.error("Error updating payment settings:", error);
      res.status(500).json({ error: "Failed to update payment settings" });
    }
  },
);
