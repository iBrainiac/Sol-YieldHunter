import { 
  userPreferences, UserPreference, InsertUserPreference,
  yieldOpportunities, YieldOpportunity, InsertYieldOpportunity,
  userPortfolios, UserPortfolio, InsertUserPortfolio,
  transactions, Transaction, InsertTransaction,
  ProtocolInfo
} from "../shared/schema";

// Modify the interface with any CRUD methods needed
export interface IStorage {
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

export class MemStorage implements IStorage {
  private userPrefsMap: Map<string, UserPreference>;
  private yieldOppsMap: Map<number, YieldOpportunity>;
  private userPortfoliosMap: Map<number, UserPortfolio>;
  private transactionsMap: Map<number, Transaction>;
  private currentIds: {
    userPrefs: number;
    yieldOpps: number;
    userPortfolios: number;
    transactions: number;
  };
  private protocolsInfo: Map<string, ProtocolInfo>;

  constructor() {
    this.userPrefsMap = new Map();
    this.yieldOppsMap = new Map();
    this.userPortfoliosMap = new Map();
    this.transactionsMap = new Map();
    this.currentIds = {
      userPrefs: 1,
      yieldOpps: 1,
      userPortfolios: 1,
      transactions: 1
    };
    this.protocolsInfo = new Map();
    this.initializeData();
  }

  // Initialize with sample data for development
  private initializeData() {
    // Protocol information
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

    // Yield opportunities
    const yields: Partial<YieldOpportunity>[] = [
      {
        name: "SOL-USDC LP",
        protocol: "Raydium",
        apy: 14.2,
        baseApy: 10.6,
        rewardApy: 3.6,
        riskLevel: "Medium",
        tvl: 24500000,
        assetType: "Liquidity Provider",
        tokenPair: ["SOL", "USDC"],
        depositFee: 0.25,
        withdrawalFee: 0.25,
        lastUpdated: new Date(),
        link: "https://raydium.io/pools"
      },
      {
        name: "Staked SOL (mSOL)",
        protocol: "Marinade",
        apy: 6.8,
        baseApy: 6.1,
        rewardApy: 0.7,
        riskLevel: "Low",
        tvl: 154200000,
        assetType: "Liquid Staking",
        tokenPair: ["SOL"],
        depositFee: 0,
        withdrawalFee: 0,
        lastUpdated: new Date(),
        link: "https://marinade.finance"
      },
      {
        name: "USDT-USDC LP",
        protocol: "Orca",
        apy: 4.3,
        baseApy: 1.2,
        rewardApy: 3.1,
        riskLevel: "Low",
        tvl: 89700000,
        assetType: "Stable Pair",
        tokenPair: ["USDT", "USDC"],
        depositFee: 0.3,
        withdrawalFee: 0.3,
        lastUpdated: new Date(),
        link: "https://www.orca.so"
      },
      {
        name: "BTC-SOL LP",
        protocol: "Raydium",
        apy: 9.7,
        baseApy: 7.2,
        rewardApy: 2.5,
        riskLevel: "Medium-High",
        tvl: 12300000,
        assetType: "Concentrated Liquidity",
        tokenPair: ["BTC", "SOL"],
        depositFee: 0.25,
        withdrawalFee: 0.25,
        lastUpdated: new Date(),
        link: "https://raydium.io/pools"
      },
      {
        name: "USDC Lending",
        protocol: "Solend",
        apy: 3.4,
        baseApy: 2.1,
        rewardApy: 1.3,
        riskLevel: "Low",
        tvl: 201100000,
        assetType: "Money Market",
        tokenPair: ["USDC"],
        depositFee: 0,
        withdrawalFee: 0,
        lastUpdated: new Date(),
        link: "https://solend.fi"
      }
    ];

    yields.forEach(yield_ => {
      const id = this.currentIds.yieldOpps++;
      const yieldOpp: YieldOpportunity = {
        id,
        name: yield_.name!,
        protocol: yield_.protocol!,
        apy: yield_.apy!,
        baseApy: yield_.baseApy!,
        rewardApy: yield_.rewardApy!,
        riskLevel: yield_.riskLevel!,
        tvl: yield_.tvl!,
        assetType: yield_.assetType!,
        tokenPair: yield_.tokenPair!,
        depositFee: yield_.depositFee!,
        withdrawalFee: yield_.withdrawalFee!,
        lastUpdated: yield_.lastUpdated!,
        link: yield_.link!
      };
      this.yieldOppsMap.set(id, yieldOpp);
    });

    // Add some initial user preferences for testing
    const defaultPrefs: UserPreference = {
      id: this.currentIds.userPrefs++,
      userId: 'default-session',
      telegramChatId: null,
      telegramUsername: null,
      riskTolerance: 'moderate',
      preferredChains: ['solana'],
      preferredTokens: ['SOL', 'USDC'],
      notificationsEnabled: true
    };
    this.userPrefsMap.set(defaultPrefs.userId, defaultPrefs);
  }

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreference | undefined> {
    return this.userPrefsMap.get(userId);
  }

  async createUserPreferences(userId: string, data: InsertUserPreference): Promise<UserPreference> {
    const id = this.currentIds.userPrefs++;
    const newPrefs: UserPreference = { id, userId, ...data };
    this.userPrefsMap.set(userId, newPrefs);
    return newPrefs;
  }

  async updateUserPreferences(userId: string, data: Partial<InsertUserPreference>): Promise<UserPreference> {
    let prefs = this.userPrefsMap.get(userId);
    
    if (!prefs) {
      const id = this.currentIds.userPrefs++;
      prefs = { 
        id, 
        userId, 
        telegramChatId: null,
        telegramUsername: null,
        riskTolerance: 'moderate',
        preferredChains: ['solana'],
        preferredTokens: [],
        notificationsEnabled: true,
        ...data 
      };
    } else {
      prefs = { ...prefs, ...data };
    }
    
    this.userPrefsMap.set(userId, prefs);
    return prefs;
  }

  async getUserRiskProfile(userId: string): Promise<{ level: string; percentage: number }> {
    const prefs = this.userPrefsMap.get(userId);
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
    let opportunities = Array.from(this.yieldOppsMap.values());

    // Filter by protocol if provided
    if (protocol && protocol !== 'all') {
      opportunities = opportunities.filter(op => 
        op.protocol.toLowerCase() === protocol.toLowerCase()
      );
    }

    // Sort based on the sortBy parameter
    switch (sortBy.toLowerCase()) {
      case 'apy':
        opportunities.sort((a, b) => Number(b.apy) - Number(a.apy));
        break;
      case 'risk':
        const riskOrder: Record<string, number> = {
          'low': 1,
          'medium': 2,
          'medium-high': 3,
          'high': 4
        };
        opportunities.sort((a, b) => 
          riskOrder[a.riskLevel.toLowerCase()] - riskOrder[b.riskLevel.toLowerCase()]
        );
        break;
      case 'tvl':
        opportunities.sort((a, b) => Number(b.tvl) - Number(a.tvl));
        break;
    }

    return opportunities;
  }

  async getYieldOpportunity(id: number): Promise<YieldOpportunity | undefined> {
    return this.yieldOppsMap.get(id);
  }

  async getBestYieldOpportunity(): Promise<YieldOpportunity | undefined> {
    const opportunities = Array.from(this.yieldOppsMap.values());
    if (opportunities.length === 0) return undefined;
    
    // Sort by APY (highest first)
    return opportunities.sort((a, b) => Number(b.apy) - Number(a.apy))[0];
  }

  async getProtocolInfo(name: string): Promise<ProtocolInfo | undefined> {
    return this.protocolsInfo.get(name);
  }

  async getYieldStats(): Promise<{ avgApy: number; protocolCount: number; opportunityCount: number }> {
    const opportunities = Array.from(this.yieldOppsMap.values());
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
    // Get user positions
    const userPositions = Array.from(this.userPortfoliosMap.values())
      .filter(portfolio => portfolio.userId === userId && portfolio.active);

    if (userPositions.length === 0) {
      return {
        totalValue: 0,
        changePercentage: 0,
        chartData: [30, 40, 35, 60, 50, 70, 65, 90, 80, 100, 90, 95],
        positions: []
      };
    }

    // Calculate total value and get position details
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

    // Generate chart data based on time range
    // This would normally come from historical data
    const chartData = this.generateChartData(timeRange);
    
    // Calculate change percentage based on time range
    const changePercentage = this.calculateChangePercentage(timeRange);

    return {
      totalValue,
      changePercentage,
      chartData,
      positions
    };
  }

  async getPortfolioSummary(userId: string): Promise<any> {
    const userPositions = Array.from(this.userPortfoliosMap.values())
      .filter(portfolio => portfolio.userId === userId && portfolio.active);

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
    // Create the portfolio entry
    const id = this.currentIds.userPortfolios++;
    const portfolioEntry: UserPortfolio = {
      id,
      userId,
      ...data,
      depositDate: new Date(),
      active: true
    };
    
    this.userPortfoliosMap.set(id, portfolioEntry);

    // Also create a transaction record for this investment
    const opportunity = await this.getYieldOpportunity(data.opportunityId);
    
    await this.createTransaction(userId, {
      userId,
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
    let transactions = Array.from(this.transactionsMap.values())
      .filter(tx => tx.userId === userId);

    // Apply filters
    if (filter !== 'all') {
      if (filter === 'invest' || filter === 'withdraw') {
        transactions = transactions.filter(tx => tx.transactionType === filter);
      } else if (filter === 'completed' || filter === 'pending' || filter === 'failed') {
        transactions = transactions.filter(tx => tx.status === filter);
      }
    }

    // Add protocol information
    return Promise.all(transactions.map(async tx => {
      const opportunity = await this.getYieldOpportunity(tx.opportunityId);
      return {
        ...tx,
        protocol: opportunity?.protocol || 'Unknown'
      };
    }));
  }

  async createTransaction(userId: string, data: InsertTransaction): Promise<Transaction> {
    const id = this.currentIds.transactions++;
    const transaction: Transaction = {
      id,
      ...data
    };
    
    this.transactionsMap.set(id, transaction);
    return transaction;
  }

  // Helper functions
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
      data[data.length - 1] = data[0] * 1.1;
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
        return parseFloat((Math.random() * 30 + 10).toFixed(1));
      default:
        return parseFloat((Math.random() * 12 + 5).toFixed(1));
    }
  }

  private generateFakeTransactionHash(): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  }
}

export const storage = new MemStorage();
