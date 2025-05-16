import type { Express, Request } from "express";

// Add session property to Request type
declare module 'express-session' {
  interface SessionData {
    sessionID: string;
  }
}

// Extend Request type to include sessionID
declare global {
  namespace Express {
    interface Request {
      sessionID: string;
    }
  }
}
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { SolanaService } from "./services/solana";
import { TelegramService } from "./services/telegram";
import { YieldAnalyzer } from "./services/yield-analyzer";
import { OpenAIService } from "./services/openai";
import { z } from "zod";
import {
  insertUserPreferencesSchema,
  insertUserPortfolioSchema,
  insertTransactionSchema,
  insertUserSchema,
  insertSolanaSubscriptionSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  const solanaService = new SolanaService();
  const telegramService = new TelegramService();
  const yieldAnalyzer = new YieldAnalyzer();
  const openAIService = new OpenAIService();

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
  
  // Subscription endpoints
  app.get("/api/wallet/subscription", async (req, res) => {
    try {
      const address = req.query.address as string;
      
      if (!address) {
        return res.status(400).json({ error: "Wallet address required" });
      }
      
      // Find user by wallet address
      const user = await storage.getUserByWalletAddress(address);
      
      if (!user) {
        return res.json({ isSubscribed: false });
      }
      
      // Check if user has an active subscription
      const isSubscribed = await storage.checkUserIsSubscribed(user.id);
      
      res.json({ isSubscribed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/wallet/subscribe", async (req, res) => {
    try {
      const subscriptionSchema = z.object({
        walletAddress: z.string(),
        transactionHash: z.string(),
        amount: z.number(),
        currency: z.string().default("USDC")
      });
      
      const { walletAddress, transactionHash, amount, currency } = subscriptionSchema.parse(req.body);
      
      // Find or create user
      let user = await storage.getUserByWalletAddress(walletAddress);
      
      if (!user) {
        user = await storage.createUser({
          walletAddress,
          username: null,
          email: null,
          lastLogin: new Date()
        });
      }
      
      // Create subscription record
      const subscription = await storage.createSubscription({
        userId: user.id,
        transactionHash,
        amount,
        currency,
        isActive: true
      });
      
      res.json({ success: true, subscription });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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
  
  // SolSeeker AI Chat Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }
      
      // Check if wallet is connected
      const walletStatus = await solanaService.getWalletStatus(req.sessionID);
      
      if (!walletStatus.connected) {
        return res.status(401).json({ error: "Wallet not connected" });
      }
      
      // Process message with OpenAI
      const result = await openAIService.processMessage(req.sessionID, message);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error processing chat message:', error);
      res.status(500).json({ error: error.message || 'Failed to process message' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
