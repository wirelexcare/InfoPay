import type { Request, Response, NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import { verifyToken, type JwtPayload } from "../lib/auth.js";
import { db } from "../db/index.js";
import { adminPermissions } from "../db/schema.js";

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    req.user = verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export const FULL_ACCESS_PERMISSION = "*";

export const ADMIN_SCOPES = [
  "users.manage",
  "kyc.manage",
  "projects.manage",
  "withdrawals.manage",
  "admins.manage",
  "roi.manage",
  "referrals.manage",
  "deposits.manage",
] as const;

export type AdminScope = (typeof ADMIN_SCOPES)[number];

// Limited admins only have the scopes explicitly granted via admin_permissions.
// A row with permission = "*" grants full access, bypassing all scope checks.
export function requirePermission(scope: AdminScope) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const adminId = req.user!.userId;
    const rows = await db
      .select({ permission: adminPermissions.permission })
      .from(adminPermissions)
      .where(eq(adminPermissions.adminId, adminId));

    const perms = new Set(rows.map((r) => r.permission));
    if (perms.has(FULL_ACCESS_PERMISSION) || perms.has(scope)) {
      return next();
    }
    return res
      .status(403)
      .json({ error: `Missing required permission: ${scope}` });
  };
}
