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
  smallint,
  integer,
  uniqueIndex,
  index,
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
  "forfeited",
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
  "referral_reward",
  "reward_claim",
  "adjustment_credit",
  "adjustment_debit",
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

export const fundingStatusEnum = pgEnum("funding_status", [
  "open",
  "target_reached",
  "stopped",
]);

export const referralRewardStatusEnum = pgEnum("referral_reward_status", [
  "credited",
  "reversed",
]);

export const manualDepositStatusEnum = pgEnum("manual_deposit_status", [
  "pending",
  "approved",
  "rejected",
]);

export const rewardTypeEnum = pgEnum("reward_type", [
  "fixed",
  "random_range",
]);

export const poolStatusEnum = pgEnum("pool_status", [
  "active",
  "exhausted",
  "expired",
  "paused",
]);

export const rewardClaimResultEnum = pgEnum("reward_claim_result", [
  "success",
  "pool_exhausted",
  "already_claimed",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
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
  maxInvestmentGhs: numeric("max_investment_ghs", {
    precision: 14,
    scale: 2,
  }),
  expectedReturnPct: numeric("expected_return_pct", {
    precision: 5,
    scale: 2,
  }).notNull(),
  durationDays: numeric("duration_days", { precision: 6, scale: 0 }).notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  fundingStatus: fundingStatusEnum("funding_status").notNull().default("open"),
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
  isManual: boolean("is_manual").notNull().default(false),
  note: text("note"),
  adjustedBy: uuid("adjusted_by").references(() => users.id, {
    onDelete: "set null",
  }),
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
  // Binance Pay fields (providerPaymentId stores the prepayId)
  providerPaymentId: varchar("provider_payment_id", { length: 100 }),
  amountGhs: numeric("amount_ghs", { precision: 14, scale: 2 }),
  payAmount: numeric("pay_amount", { precision: 20, scale: 8 }),
  payCurrency: varchar("pay_currency", { length: 20 }),
  payAddress: varchar("pay_address", { length: 255 }),
  checkoutUrl: text("checkout_url"),
  qrcodeLink: text("qrcode_link"),
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

export const referralCodes = pgTable("referral_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referralRelationships = pgTable("referral_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refereeId: uuid("referee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  level: smallint("level").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referralRewards = pgTable("referral_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refereeId: uuid("referee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  level: smallint("level").notNull(),
  investmentId: uuid("investment_id")
    .notNull()
    .references(() => investments.id, { onDelete: "cascade" }),
  investmentAmountGhs: numeric("investment_amount_ghs", {
    precision: 14,
    scale: 2,
  }).notNull(),
  rewardPercentage: numeric("reward_percentage", {
    precision: 5,
    scale: 2,
  }).notNull(),
  rewardAmountGhs: numeric("reward_amount_ghs", {
    precision: 14,
    scale: 2,
  }).notNull(),
  status: referralRewardStatusEnum("status").notNull().default("credited"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  // One reward per investment per referral level — required by the
  // onConflictDoNothing target in creditReferralRewards.
  investmentLevelUnique: uniqueIndex("referral_rewards_investment_level_unique").on(
    t.investmentId,
    t.level,
  ),
}));

export const referralConfig = pgTable("referral_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: smallint("level").notNull().unique(),
  rewardPercentage: numeric("reward_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const depositSettings = pgTable("deposit_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 30 }).notNull().unique().default("momo"),
  network: varchar("network", { length: 30 }).notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountNumber: varchar("account_number", { length: 30 }).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Which deposit/top-up methods are visible to users; admin-controlled.
export const depositMethodSettings = pgTable("deposit_method_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  momoEnabled: boolean("momo_enabled").notNull().default(true),
  cryptoEnabled: boolean("crypto_enabled").notNull().default(true),
  chatEnabled: boolean("chat_enabled").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const manualDeposits = pgTable("manual_deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reference: varchar("reference", { length: 20 }).notNull().unique(),
  amountGhs: numeric("amount_ghs", { precision: 14, scale: 2 }).notNull(),
  network: varchar("network", { length: 30 }).notNull(),
  senderName: varchar("sender_name", { length: 255 }).notNull(),
  senderNumber: varchar("sender_number", { length: 30 }).notNull(),
  screenshotUrl: text("screenshot_url").notNull(),
  status: manualDepositStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rewardPools = pgTable("reward_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  totalPoolGhs: numeric("total_pool_ghs", { precision: 14, scale: 2 }).notNull(),
  claimedPoolGhs: numeric("claimed_pool_ghs", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  rewardType: rewardTypeEnum("reward_type").notNull(),
  fixedAmountGhs: numeric("fixed_amount_ghs", { precision: 14, scale: 2 }),
  minAmountGhs: numeric("min_amount_ghs", { precision: 14, scale: 2 }),
  maxAmountGhs: numeric("max_amount_ghs", { precision: 14, scale: 2 }),
  allowDuplicateClaims: boolean("allow_duplicate_claims").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  status: poolStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rewardClaims = pgTable("reward_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .notNull()
    .references(() => rewardPools.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  claimedAmountGhs: numeric("claimed_amount_ghs", {
    precision: 14,
    scale: 2,
  }).notNull(),
  transactionId: uuid("transaction_id").references(() => walletTransactions.id, {
    onDelete: "set null",
  }),
  claimResult: rewardClaimResultEnum("claim_result").notNull().default("success"),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
});

export const rewardPoolAudit = pgTable("reward_pool_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .notNull()
    .references(() => rewardPools.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  adminId: uuid("admin_id").references(() => users.id, {
    onDelete: "set null",
  }),
  changes: jsonb("changes"),
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

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatSenderRoleEnum = pgEnum("chat_sender_role", [
  "user",
  "admin",
  "system",
]);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Thread owner: always the investor's userId, even for admin/system messages
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Actual author (admin's id for admin messages; null for system messages)
    senderId: uuid("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    senderRole: chatSenderRoleEnum("sender_role").notNull(),
    body: text("body"),
    imageUrl: text("image_url"),
    // When set, the message renders as a top-up request card
    manualDepositId: uuid("manual_deposit_id").references(
      () => manualDeposits.id,
      { onDelete: "set null" },
    ),
    readByUser: boolean("read_by_user").notNull().default(false),
    readByAdmin: boolean("read_by_admin").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("chat_messages_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  }),
);

export const supportSettings = pgTable("support_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  whatsappChannelUrl: text("whatsapp_channel_url"),
  telegramGroupUrl: text("telegram_group_url"),
  telegramProfiles: jsonb("telegram_profiles")
    .$type<{ label: string; url: string }[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentSettings = pgTable("payment_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  minDepositGhs: numeric("min_deposit_ghs", { precision: 14, scale: 2 }),
  maxDepositGhs: numeric("max_deposit_ghs", { precision: 14, scale: 2 }),
  minWithdrawalGhs: numeric("min_withdrawal_ghs", { precision: 14, scale: 2 }),
  maxWithdrawalGhs: numeric("max_withdrawal_ghs", { precision: 14, scale: 2 }),
  depositFeePct: numeric("deposit_fee_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  withdrawalFeePct: numeric("withdrawal_fee_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  // Weekdays withdrawals are allowed (0=Sunday..6=Saturday); empty = every day.
  withdrawalDays: jsonb("withdrawal_days").$type<number[]>().notNull().default([]),
  // "HH:MM" 24h in GMT (Ghana time); both null = any time of day.
  withdrawalStartTime: varchar("withdrawal_start_time", { length: 5 }),
  withdrawalEndTime: varchar("withdrawal_end_time", { length: 5 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
