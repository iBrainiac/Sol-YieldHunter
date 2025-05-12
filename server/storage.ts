import { 
  userPreferences, UserPreference, InsertUserPreference,
  yieldOpportunities, YieldOpportunity, InsertYieldOpportunity,
  userPortfolios, UserPortfolio, InsertUserPortfolio,
  transactions, Transaction, InsertTransaction,
  ProtocolInfo,
  users, User, InsertUser,
  solanaSubscriptions, SolanaSubscription, InsertSolanaSubscription,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or } from "drizzle-orm";

// Modify the interface with any CRUD methods needed
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByWalletAddress(walletAddress: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Subscriptions
  getUserSubscription(userId: number): Promise<SolanaSubscription | undefined>;
  createSubscription(insertSubscription: InsertSolanaSubscription): Promise<SolanaSubscription>;
  checkUserIsSubscribed(userId: number): Promise<boolean>;
  
  // User Preferences
  getUserPreferences(userId: string): Promise<UserPreference | undefined>;
  createUserPreferences(userId: string, data: InsertUserPreference): Promise<UserPreference>;
  updateUserPreferences(userId: string, data: Partial<InsertUserPreference>): Promise<UserPreference>;
  getUserRiskProfile(userId: string): Promise<{ level: string; percentage: number }>;

  // Yield Opportunities
  getYieldOpportunities(protocol?: string, sortBy?: string): Promise<YieldOpportunity[]>;
  getYieldOpportunity(id: number): Promise<YieldOpportunity | undefined>;
  getBestYieldOpportunity(): Promise<YieldOpportunity | undefined>;
  getProtocolInfo(name: string): Promise<ProtocolInfo | undefined>;
  getYieldStats(): Promise<{ avgApy: number; protocolCount: number; opportunityCount: number }>;

  // User Portfolios
  getUserPortfolio(userId: string, timeRange: string): Promise<any>;
  getPortfolioSummary(userId: string): Promise<any>;
  createInvestment(userId: string, data: InsertUserPortfolio): Promise<UserPortfolio>;
  
  // Transactions
  getUserTransactions(userId: string, filter: string): Promise<Transaction[]>;
  createTransaction(userId: string, data: InsertTransaction): Promise<Transaction>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private protocolsInfo: Map<string, ProtocolInfo>;

  constructor() {
    this.protocolsInfo = new Map();
    // Initialize the protocol information
    const protocols: ProtocolInfo[] = [
      { name: "Raydium", logo: "gradient-to-r from-pink-500 to-purple-500", url: "https://raydium.io" },
      { name: "Marinade", logo: "orange-500", url: "https://marinade.finance" },
      { name: "Orca", logo: "blue-600", url: "https://www.orca.so" },
      { name: "Solend", logo: "purple-600", url: "https://solend.fi" },
      { name: "Tulip", logo: "yellow-500", url: "https://tulip.garden" }
    ];

    protocols.forEach(protocol => {
      this.protocolsInfo.set(protocol.name, protocol);
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Subscriptions
  async getUserSubscription(userId: number): Promise<SolanaSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(solanaSubscriptions)
      .where(eq(solanaSubscriptions.userId, userId));
    return subscription || undefined;
  }

  async createSubscription(insertSubscription: InsertSolanaSubscription): Promise<SolanaSubscription> {
    const [subscription] = await db
      .insert(solanaSubscriptions)
      .values(insertSubscription)
      .returning();
    return subscription;
  }

  async checkUserIsSubscribed(userId: number): Promise<boolean> {
    const [subscription] = await db
      .select()
      .from(solanaSubscriptions)
      .where(and(
        eq(solanaSubscriptions.userId, userId),
        eq(solanaSubscriptions.isActive, true)
      ));
    return !!subscription;
  }

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreference | undefined> {
    // First, try to find the user by wallet address
    const user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      return undefined;
    }
    
    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id));
      
    return preferences || undefined;
  }

  async createUserPreferences(userId: string, data: InsertUserPreference): Promise<UserPreference> {
    // Get the user ID first
    let user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      // Create a new user if they don't exist
      user = await this.createUser({
        walletAddress: userId,
        username: null,
        email: null,
        lastLogin: new Date()
      });
    }
    
    // Now create the preferences
    const [preferences] = await db
      .insert(userPreferences)
      .values({
        ...data,
        userId: user.id
      })
      .returning();
      
    return preferences;
  }

  async updateUserPreferences(userId: string, data: Partial<InsertUserPreference>): Promise<UserPreference> {
    let user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      // Create a new user if they don't exist
      user = await this.createUser({
        walletAddress: userId,
        username: null,
        email: null,
        lastLogin: new Date()
      });
    }
    
    // Check if preferences already exist
    let [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id));
      
    if (preferences) {
      // Update existing preferences
      [preferences] = await db
        .update(userPreferences)
        .set(data)
        .where(eq(userPreferences.id, preferences.id))
        .returning();
    } else {
      // Create new preferences
      [preferences] = await db
        .insert(userPreferences)
        .values({
          userId: user.id,
          telegramChatId: null,
          telegramUsername: null,
          riskTolerance: 'moderate',
          preferredChains: ['solana'],
          preferredTokens: [],
          notificationsEnabled: true,
          ...data
        })
        .returning();
    }
    
    return preferences;
  }

  async getUserRiskProfile(userId: string): Promise<{ level: string; percentage: number }> {
    const prefs = await this.getUserPreferences(userId);
    
    if (!prefs) {
      return { level: 'moderate-conservative', percentage: 35 };
    }

    const riskMap: Record<string, number> = {
      'conservative': 20,
      'moderate-conservative': 35,
      'moderate': 50,
      'moderate-aggressive': 70,
      'aggressive': 90
    };

    return {
      level: prefs.riskTolerance,
      percentage: riskMap[prefs.riskTolerance] || 50
    };
  }

  // Yield Opportunities
  async getYieldOpportunities(protocol?: string, sortBy: string = 'apy'): Promise<YieldOpportunity[]> {
    let query = db.select().from(yieldOpportunities);
    
    // Filter by protocol if provided
    if (protocol && protocol !== 'all') {
      query = query.where(eq(yieldOpportunities.protocol, protocol));
    }
    
    // Sort based on sortBy parameter
    switch (sortBy.toLowerCase()) {
      case 'apy':
        query = query.orderBy(desc(yieldOpportunities.apy));
        break;
      case 'tvl':
        query = query.orderBy(desc(yieldOpportunities.tvl));
        break;
      case 'risk':
        // This is more complex as risk level is a string
        // Will need to add a custom sort or consider adding a numeric risk level field
        // For now, just return without explicit ordering
        break;
    }
    
    return await query;
  }

  async getYieldOpportunity(id: number): Promise<YieldOpportunity | undefined> {
    const [opportunity] = await db
      .select()
      .from(yieldOpportunities)
      .where(eq(yieldOpportunities.id, id));
      
    return opportunity || undefined;
  }

  async getBestYieldOpportunity(): Promise<YieldOpportunity | undefined> {
    const [opportunity] = await db
      .select()
      .from(yieldOpportunities)
      .orderBy(desc(yieldOpportunities.apy))
      .limit(1);
      
    return opportunity || undefined;
  }

  async getProtocolInfo(name: string): Promise<ProtocolInfo | undefined> {
    return this.protocolsInfo.get(name);
  }

  async getYieldStats(): Promise<{ avgApy: number; protocolCount: number; opportunityCount: number }> {
    const opportunities = await db.select().from(yieldOpportunities);
    const protocols = new Set(opportunities.map(o => o.protocol));
    
    const totalApy = opportunities.reduce((sum, op) => sum + Number(op.apy), 0);
    const avgApy = opportunities.length > 0 ? parseFloat((totalApy / opportunities.length).toFixed(2)) : 0;
    
    return {
      avgApy,
      protocolCount: protocols.size,
      opportunityCount: opportunities.length
    };
  }

  // User Portfolios
  async getUserPortfolio(userId: string, timeRange: string = '1M'): Promise<any> {
    // Get the user ID first
    const user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      return {
        totalValue: 0,
        changePercentage: 0,
        chartData: [30, 40, 35, 60, 50, 70, 65, 90, 80, 100, 90, 95],
        positions: []
      };
    }
    
    // Get user positions
    const userPositions = await db
      .select()
      .from(userPortfolios)
      .where(and(
        eq(userPortfolios.userId, user.id),
        eq(userPortfolios.active, true)
      ));

    if (userPositions.length === 0) {
      return {
        totalValue: 0,
        changePercentage: 0,
        chartData: [30, 40, 35, 60, 50, 70, 65, 90, 80, 100, 90, 95],
        positions: []
      };
    }

    // Calculate total value
    const totalValue = userPositions.reduce((sum, pos) => sum + Number(pos.amount), 0);
    
    // Map to position details with protocol
    const positions = await Promise.all(userPositions.map(async (pos) => {
      const opportunity = await this.getYieldOpportunity(pos.opportunityId);
      return {
        ...pos,
        name: opportunity?.name || 'Unknown Opportunity',
        protocol: opportunity?.protocol || 'Unknown',
        apy: opportunity?.apy || 0
      };
    }));

    // Generate chart data and change percentage
    const chartData = this.generateChartData(timeRange);
    const changePercentage = this.calculateChangePercentage(timeRange);

    return {
      totalValue,
      changePercentage,
      chartData,
      positions
    };
  }

  async getPortfolioSummary(userId: string): Promise<any> {
    // Get the user ID first
    const user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      return {
        activePositions: 0,
        protocolCount: 0,
        protocols: []
      };
    }
    
    // Get user positions
    const userPositions = await db
      .select()
      .from(userPortfolios)
      .where(and(
        eq(userPortfolios.userId, user.id),
        eq(userPortfolios.active, true)
      ));

    if (userPositions.length === 0) {
      return {
        activePositions: 0,
        protocolCount: 0,
        protocols: []
      };
    }

    // Get unique protocols from user positions
    const uniqueOpportunityIds = new Set(userPositions.map(pos => pos.opportunityId));
    const protocols = new Set<string>();
    
    for (const id of uniqueOpportunityIds) {
      const opportunity = await this.getYieldOpportunity(id);
      if (opportunity) {
        protocols.add(opportunity.protocol);
      }
    }

    return {
      activePositions: userPositions.length,
      protocolCount: protocols.size,
      protocols: Array.from(protocols)
    };
  }

  async createInvestment(userId: string, data: InsertUserPortfolio): Promise<UserPortfolio> {
    // Get the user ID first
    let user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      // Create a new user if they don't exist
      user = await this.createUser({
        walletAddress: userId,
        username: null,
        email: null,
        lastLogin: new Date()
      });
    }
    
    // Create the portfolio entry
    const [portfolioEntry] = await db
      .insert(userPortfolios)
      .values({
        ...data,
        userId: user.id,
        depositDate: new Date(),
        active: true
      })
      .returning();
    
    // Also create a transaction record for this investment
    const opportunity = await this.getYieldOpportunity(data.opportunityId);
    
    await this.createTransaction(userId, {
      userId: String(user.id), // This interface expects a string
      opportunityId: data.opportunityId,
      transactionType: 'invest',
      amount: data.amount,
      token: data.token,
      transactionDate: new Date(),
      status: 'completed',
      transactionHash: this.generateFakeTransactionHash(),
      details: { 
        protocol: opportunity?.protocol || 'Unknown',
        opportunityName: opportunity?.name || 'Unknown' 
      }
    });

    return portfolioEntry;
  }

  // Transactions
  async getUserTransactions(userId: string, filter: string = 'all'): Promise<Transaction[]> {
    // Get the user ID first
    const user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      return [];
    }
    
    // Build query
    let query = db.select().from(transactions).where(eq(transactions.userId, user.id));
    
    // Apply filters
    if (filter !== 'all') {
      if (filter === 'invest' || filter === 'withdraw') {
        query = query.where(eq(transactions.transactionType, filter));
      } else if (filter === 'completed' || filter === 'pending' || filter === 'failed') {
        query = query.where(eq(transactions.status, filter));
      }
    }
    
    const userTransactions = await query;
    
    // Add protocol information
    return Promise.all(userTransactions.map(async tx => {
      const opportunity = await this.getYieldOpportunity(tx.opportunityId);
      return {
        ...tx,
        protocol: opportunity?.protocol || 'Unknown'
      };
    }));
  }

  async createTransaction(userId: string, data: InsertTransaction): Promise<Transaction> {
    // Get the user ID first
    let user = await this.getUserByWalletAddress(userId);
    
    if (!user) {
      // Create a new user if they don't exist
      user = await this.createUser({
        walletAddress: userId,
        username: null,
        email: null,
        lastLogin: new Date()
      });
    }
    
    // Create the transaction
    const [transaction] = await db
      .insert(transactions)
      .values({
        ...data,
        userId: user.id // Convert string to number
      })
      .returning();
      
    return transaction;
  }

  // Helper methods
  private generateChartData(timeRange: string): number[] {
    // Generate random chart data based on time range
    const pointCount = timeRange === '1D' ? 24 : 
                        timeRange === '1W' ? 7 : 
                        timeRange === '1M' ? 30 : 
                        timeRange === '1Y' ? 12 : 24;
    
    // Generate a somewhat realistic chart (upward trend with some fluctuations)
    const baseValue = 30;
    const maxValue = 100;
    const volatility = timeRange === '1D' ? 5 : 
                       timeRange === '1W' ? 10 : 
                       timeRange === '1M' ? 15 : 
                       timeRange === '1Y' ? 25 : 15;
    
    let currentValue = baseValue;
    const data: number[] = [];
    
    for (let i = 0; i < pointCount; i++) {
      const change = (Math.random() - 0.3) * volatility; // Slight upward bias
      currentValue = Math.max(baseValue, Math.min(maxValue, currentValue + change));
      data.push(Math.round(currentValue));
    }
    
    // Make sure the last value is higher than the first for a positive trend
    if (data[data.length - 1] < data[0]) {
      data[data.length - 1] = Math.round(data[0] * 1.1);
    }
    
    return data;
  }

  private calculateChangePercentage(timeRange: string): number {
    // This would be calculated based on historical data
    // Simulating different returns based on time range
    switch (timeRange) {
      case '1D':
        return parseFloat((Math.random() * 2 - 0.5).toFixed(1));
      case '1W':
        return parseFloat((Math.random() * 5 + 1).toFixed(1));
      case '1M':
        return parseFloat((Math.random() * 8 + 3).toFixed(1));
      case '1Y':
        return parseFloat((Math.random() * 12 + 5).toFixed(1));
      default:
        return parseFloat((Math.random() * 5 + 2).toFixed(1));
    }
  }

  private generateFakeTransactionHash(): string {
    return Array.from({ length: 64 }, () => 
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
  }
}

// Export an instance of the storage class
export const storage = new DatabaseStorage();