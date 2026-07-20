import {
  pgTable,
  uuid,
  text,
  varchar,
  numeric,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const kycStatusEnum = pgEnum("kyc_status", [
  "pending",
  "verified",
  "rejected",
]);

export const userRoleEnum = pgEnum("user_role", ["investor", "admin"]);

export const investmentStatusEnum = pgEnum("investment_status", [
  "pending",
  "active",
  "completed",
  "cancelled",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "scheduled",
  "paid",
  "failed",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "paystack",
  "crypto",
]);

export const walletTxTypeEnum = pgEnum("wallet_tx_type", [
  "deposit",
  "withdrawal",
  "investment",
  "payout",
  "refund",
]);

export const walletTxStatusEnum = pgEnum("wallet_tx_status", [
  "pending",
  "completed",
  "failed",
]);

export const withdrawalMethodTypeEnum = pgEnum("withdrawal_method_type", [
  "momo",
  "bank",
  "crypto",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(),
  preferredCurrency: varchar("preferred_currency", { length: 3 })
    .notNull()
    .default("GHS"),
  role: userRoleEnum("role").notNull().default("investor"),
  kycStatus: kycStatusEnum("kyc_status").notNull().default("pending"),
  isSuspended: boolean("is_suspended").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kycVerifications = pgTable("kyc_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(),
  province: varchar("province", { length: 255 }).notNull(),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }).notNull(),
  status: kycStatusEnum("status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  targetAmountGhs: numeric("target_amount_ghs", {
    precision: 14,
    scale: 2,
  }).notNull(),
  raisedAmountGhs: numeric("raised_amount_ghs", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0"),
  minInvestmentGhs: numeric("min_investment_ghs", {
    precision: 14,
    scale: 2,
  }).notNull(),
  expectedReturnPct: numeric("expected_return_pct", {
    precision: 5,
    scale: 2,
  }).notNull(),
  durationMonths: numeric("duration_months", { precision: 4, scale: 0 }).notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const investments = pgTable("investments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "restrict" }),
  amountGhs: numeric("amount_ghs", { precision: 14, scale: 2 }).notNull(),
  status: investmentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  investmentId: uuid("investment_id")
    .notNull()
    .references(() => investments.id, { onDelete: "cascade" }),
  amountGhs: numeric("amount_ghs", { precision: 14, scale: 2 }).notNull(),
  status: payoutStatusEnum("status").notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  totalInvestedGhs: numeric("total_invested_ghs", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0"),
  totalReturnsGhs: numeric("total_returns_ghs", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cryptoPayments = pgTable("crypto_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  investmentId: uuid("investment_id").references(() => investments.id, {
    onDelete: "set null",
  }),
  network: varchar("network", { length: 50 }).notNull().default("TRC20"),
  asset: varchar("asset", { length: 20 }).notNull().default("USDT"),
  amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
  txHash: varchar("tx_hash", { length: 255 }),
  confirmed: boolean("confirmed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // NOWPayments fields
  providerPaymentId: varchar("provider_payment_id", { length: 100 }),
  amountGhs: numeric("amount_ghs", { precision: 14, scale: 2 }),
  payAmount: numeric("pay_amount", { precision: 20, scale: 8 }),
  payCurrency: varchar("pay_currency", { length: 20 }),
  payAddress: varchar("pay_address", { length: 255 }),
  status: varchar("status", { length: 30 }).notNull().default("waiting"),
});

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  balanceGhs: numeric("balance_ghs", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: walletTxTypeEnum("type").notNull(),
  amountGhs: numeric("amount_ghs", { precision: 14, scale: 2 }).notNull(),
  balanceBeforeGhs: numeric("balance_before_ghs", {
    precision: 14,
    scale: 2,
  }).notNull(),
  balanceAfterGhs: numeric("balance_after_ghs", {
    precision: 14,
    scale: 2,
  }).notNull(),
  status: walletTxStatusEnum("status").notNull().default("completed"),
  method: varchar("method", { length: 30 }),
  reference: varchar("reference", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const withdrawalMethods = pgTable("withdrawal_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: withdrawalMethodTypeEnum("type").notNull(),
  network: varchar("network", { length: 30 }),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountNumber: varchar("account_number", { length: 100 }),
  cryptoAddress: varchar("crypto_address", { length: 255 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 50 }),
  resourceId: varchar("resource_id", { length: 255 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminPermissions = pgTable("admin_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permission: varchar("permission", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const confirmationTokens = pgTable("confirmation_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  actionData: jsonb("action_data"),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedBy: uuid("confirmed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
