import { db } from "./src/db/index.js";
import { users } from "./src/db/schema.js";
import { hashPassword } from "./src/lib/auth.js";

async function seedAdmin() {
  try {
    const email = "wirelexcare@gmail.com";
    const password = "Wire@24";
    const fullName = "Admin";

    // Check if user exists
    const { eq } = await import("drizzle-orm");
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    const passwordHash = await hashPassword(password);

    if (existing.length > 0) {
      // Update existing user
      const [updated] = await db
        .update(users)
        .set({
          passwordHash,
          role: "admin",
          kycStatus: "verified",
          fullName,
        })
        .where(eq(users.email, email))
        .returning();

      console.log(`✓ Admin account updated:`, {
        id: updated.id,
        email: updated.email,
        role: updated.role,
      });
      return;
    }

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName,
        country: "GH",
        role: "admin",
        kycStatus: "verified",
      })
      .returning();

    console.log(`✓ Admin account created:`, {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
}

seedAdmin().then(() => process.exit(0));
