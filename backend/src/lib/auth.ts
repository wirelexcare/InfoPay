import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

const JWT_EXPIRY = (process.env.JWT_EXPIRY ?? "1h") as SignOptions["expiresIn"];
const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY ??
  "7d") as SignOptions["expiresIn"];

export interface JwtPayload {
  userId: string;
  role: "investor" | "admin";
}

type TokenType = "access" | "refresh";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "access" }, JWT_SECRET as string, {
    expiresIn: JWT_EXPIRY,
    algorithm: "HS256",
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, type: "refresh" }, JWT_SECRET as string, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: "HS256",
  });
}

// Verify a token, pinning HS256 (rejects alg=none / algorithm confusion) and
// optionally enforcing the token type so a long-lived refresh token can't be
// presented as an access token on protected routes.
export function verifyToken(
  token: string,
  expectedType: TokenType = "access",
): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET as string, {
    algorithms: ["HS256"],
  }) as JwtPayload & { type?: TokenType };
  if (decoded.type !== expectedType) {
    throw new Error("Invalid token type");
  }
  return { userId: decoded.userId, role: decoded.role };
}
