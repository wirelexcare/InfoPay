import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { manualDeposits } from "../db/schema.js";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function randomSuffix(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

/**
 * Generates a fresh, human-readable payment reference for a manual deposit
 * (e.g. AH-7K3N9P). Not persisted here — the client shows it to the user
 * before they pay, and it's only written to manual_deposits at submission
 * time (with a DB-level unique constraint as the final safety net).
 */
export async function generateDepositReference(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `AH-${randomSuffix()}`;
    const [existing] = await db
      .select({ id: manualDeposits.id })
      .from(manualDeposits)
      .where(eq(manualDeposits.reference, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique deposit reference");
}
