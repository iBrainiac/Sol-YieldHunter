import { pgTable, text, serial, integer, boolean, jsonb, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User preferences
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  telegramChatId: text("telegram_chat_id"),
  telegramUsername: text("telegram_username"),
  riskTolerance: text("risk_tolerance").default("medium"),
  preferredChains: text("preferred_chains").array(),
  preferredTokens: text("preferred_tokens").array(),
  notificationsEnabled: boolean("notifications_enabled").default(true),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
});

// Yield opportunity
export const yieldOpportunities = pgTable("yield_opportunities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  protocol: text("protocol").notNull(),
  apy: numeric("apy", { precision: 6, scale: 2 }).notNull(),
  baseApy: numeric("base_apy", { precision: 6, scale: 2 }).notNull(),
  rewardApy: numeric("reward_apy", { precision: 6, scale: 2 }).notNull(),
  riskLevel: text("risk_level").notNull(),
  tvl: numeric("tvl", { precision: 20, scale: 2 }).notNull(),
  assetType: text("asset_type").notNull(),
  tokenPair: text("token_pair").array(),
  depositFee: numeric("deposit_fee", { precision: 6, scale: 2 }).default("0"),
  withdrawalFee: numeric("withdrawal_fee", { precision: 6, scale: 2 }).default("0"),
  lastUpdated: timestamp("last_updated").notNull(),
  link: text("link"),
});

export const insertYieldOpportunitySchema = createInsertSchema(yieldOpportunities).omit({
  id: true,
});

// User portfolio
export const userPortfolios = pgTable("user_portfolios", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  opportunityId: integer("opportunity_id").notNull(),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  depositDate: timestamp("deposit_date").notNull(),
  token: text("token").notNull(),
  active: boolean("active").default(true),
});

export const insertUserPortfolioSchema = createInsertSchema(userPortfolios).omit({
  id: true,
});

// Transaction records
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  opportunityId: integer("opportunity_id").notNull(),
  transactionType: text("transaction_type").notNull(), // 'invest', 'withdraw'
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  token: text("token").notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  transactionHash: text("transaction_hash"),
  details: jsonb("details"),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
});

// Define the types
export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferencesSchema>;

export type YieldOpportunity = typeof yieldOpportunities.$inferSelect;
export type InsertYieldOpportunity = z.infer<typeof insertYieldOpportunitySchema>;

export type UserPortfolio = typeof userPortfolios.$inferSelect;
export type InsertUserPortfolio = z.infer<typeof insertUserPortfolioSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Custom types for API responses
export interface SolanaWalletInfo {
  address: string;
  balance: number;
  balanceInUsd: number;
}

export interface ProtocolInfo {
  name: string;
  logo: string;
  url: string;
}

export interface TelegramBotInfo {
  botName: string;
  isConnected: boolean;
  chatId?: string;
  username?: string;
}
