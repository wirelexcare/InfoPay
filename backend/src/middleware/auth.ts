import type { Request, Response, NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import { verifyToken, type JwtPayload } from "../lib/auth.js";
import { db } from "../db/index.js";
import { adminPermissions, users } from "../db/schema.js";

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  let payload: JwtPayload;
  try {
    // verifyToken pins HS256 and rejects refresh tokens used as access tokens.
    payload = verifyToken(header.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Re-check the account each request so a suspension (or role change) takes
  // effect immediately instead of lingering until the token expires. The
  // fresh role also prevents a demoted admin from acting on a stale token.
  try {
    const [account] = await db
      .select({ role: users.role, isSuspended: users.isSuspended })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    if (!account) {
      return res.status(401).json({ error: "Account no longer exists" });
    }
    if (account.isSuspended) {
      return res.status(403).json({ error: "This account has been suspended" });
    }
    req.user = { userId: payload.userId, role: account.role };
    next();
  } catch (error) {
    console.error("Auth account lookup failed:", error);
    return res.status(500).json({ error: "Authentication failed" });
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
  "rewards.manage",
  "announcements.manage",
  "support.manage",
  "chats.manage",
  "payments.manage",
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
