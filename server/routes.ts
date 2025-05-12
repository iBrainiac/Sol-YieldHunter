import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { SolanaService } from "./services/solana";
import { TelegramService } from "./services/telegram";
import { YieldAnalyzer } from "./services/yield-analyzer";
import { z } from "zod";
import {
  insertUserPreferencesSchema,
  insertUserPortfolioSchema,
  insertTransactionSchema
} from "../shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  const solanaService = new SolanaService();
  const telegramService = new TelegramService();
  const yieldAnalyzer = new YieldAnalyzer();

  // API routes
  // ===========================================================

  // Wallet Routes
  app.get("/api/wallet/status", async (req, res) => {
    try {
      const walletStatus = await solanaService.getWalletStatus(req.sessionID);
      res.json(walletStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/wallet/connect", async (req, res) => {
    try {
      // In a real app, we would handle wallet signature validation
      // For this demo, we'll simulate connecting with a test wallet
      const walletData = await solanaService.connectWallet(req.sessionID);
      res.json(walletData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/wallet/disconnect", async (req, res) => {
    try {
      await solanaService.disconnectWallet(req.sessionID);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/wallet/info", async (req, res) => {
    try {
      const walletInfo = await solanaService.getWalletInfo(req.sessionID);
      res.json(walletInfo);
    } catch (error: any) {
      res.status(401).json({ error: "Not connected" });
    }
  });

  // Yield Routes
  app.get("/api/yields", async (req, res) => {
    try {
      const protocol = req.query.protocol as string;
      const sortBy = req.query.sortBy as string;
      const opportunities = await yieldAnalyzer.getYieldOpportunities(protocol, sortBy);
      res.json(opportunities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/yields/best", async (req, res) => {
    try {
      const bestYield = await yieldAnalyzer.getBestYieldOpportunity();
      res.json(bestYield);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/yields/stats", async (req, res) => {
    try {
      const stats = await yieldAnalyzer.getYieldStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Portfolio Routes
  app.get("/api/portfolio", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || "1M";
      const portfolio = await storage.getUserPortfolio(req.sessionID, timeRange);
      res.json(portfolio);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/portfolio/summary", async (req, res) => {
    try {
      const summary = await storage.getPortfolioSummary(req.sessionID);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portfolio/invest", async (req, res) => {
    try {
      const investData = insertUserPortfolioSchema.parse(req.body);
      const result = await storage.createInvestment(req.sessionID, investData);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Transaction Routes
  app.get("/api/transactions", async (req, res) => {
    try {
      const filter = req.query.filter as string || "all";
      const transactions = await storage.getUserTransactions(req.sessionID, filter);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      const result = await storage.createTransaction(req.sessionID, transactionData);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // User Preference Routes
  app.get("/api/user/preferences", async (req, res) => {
    try {
      const preferences = await storage.getUserPreferences(req.sessionID);
      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/user/preferences", async (req, res) => {
    try {
      const preferencesData = insertUserPreferencesSchema.partial().parse(req.body);
      const result = await storage.updateUserPreferences(req.sessionID, preferencesData);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/user/risk-profile", async (req, res) => {
    try {
      const riskProfile = await storage.getUserRiskProfile(req.sessionID);
      res.json(riskProfile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Telegram Routes
  app.post("/api/telegram/connect", async (req, res) => {
    try {
      const telegramInfo = await telegramService.generateConnectLink(req.sessionID);
      res.json(telegramInfo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user/telegram-status", async (req, res) => {
    try {
      const telegramStatus = await telegramService.checkUserConnection(req.sessionID);
      res.json(telegramStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
