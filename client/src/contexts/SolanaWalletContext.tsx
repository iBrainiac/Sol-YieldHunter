import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { checkSubscription } from '@/lib/subscription';
import { useToast } from '@/hooks/use-toast';

// Default admin public key (replace with your admin wallet when deploying)
export const ADMIN_PUBKEY = new PublicKey('11111111111111111111111111111111');

// Define the wallet context type
interface SolanaWalletContextType {
  publicKey: PublicKey | null;
  isConnected: boolean;
  balance: number | null;
  isSubscribed: boolean;
  connecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signTransaction: (transaction: any) => Promise<any>;
  sendTransaction: (transaction: any) => Promise<string>;
  connection: Connection | null;
}

// Create the wallet context
const SolanaWalletContext = createContext<SolanaWalletContextType>({
  publicKey: null,
  isConnected: false,
  balance: null,
  isSubscribed: false,
  connecting: false,
  connectWallet: async () => {},
  disconnectWallet: async () => {},
  signTransaction: async (transaction: any) => transaction,
  sendTransaction: async (transaction: any) => '',
  connection: null,
});

// Hook to use the wallet context
export const useSolanaWallet = () => useContext(SolanaWalletContext);

// Provider component
export const SolanaWalletProvider = ({ children }: { children: ReactNode }) => {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const { toast } = useToast();

  // Initialize the connection
  useEffect(() => {
    const conn = new Connection(
      import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet'),
      'confirmed'
    );
    setConnection(conn);
  }, []);

  // Check for wallet providers like Phantom, Solflare, etc.
  useEffect(() => {
    const checkForWallets = () => {
      // Check for Phantom
      if (window.phantom?.solana) {
        return window.phantom.solana;
      }
      // Check for Solflare
      else if (window.solflare) {
        return window.solflare;
      }
      // Add checks for other wallet providers as needed
    };

    const detectedWallet = checkForWallets();
    if (detectedWallet) {
      setWallet(detectedWallet);
    }
  }, []);

  // Check if connected when wallet changes
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (wallet && wallet.isConnected) {
        setPublicKey(wallet.publicKey);
        setIsConnected(true);
        await updateBalance();
        await checkUserSubscription();
      }
    };

    checkWalletConnection();
  }, [wallet]);

  // Update balance when connection/publicKey changes
  const updateBalance = async () => {
    if (connection && publicKey) {
      try {
        const balance = await connection.getBalance(publicKey);
        setBalance(balance / 1000000000); // Convert lamports to SOL
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  };

  // Check if user has an active subscription
  const checkUserSubscription = async () => {
    if (connection && publicKey) {
      try {
        const subscribed = await checkSubscription(connection, publicKey);
        setIsSubscribed(subscribed);
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    }
  };

  // Connect wallet
  const connectWallet = async () => {
    if (!wallet) {
      toast({
        title: 'Wallet not found',
        description: 'Please install Phantom or Solflare wallet extension',
        variant: 'destructive',
      });
      return;
    }

    setConnecting(true);
    try {
      const { publicKey } = await wallet.connect();
      
      if (publicKey) {
        setPublicKey(publicKey);
        setIsConnected(true);
        
        // Update the balance
        await updateBalance();
        
        // Check subscription status
        await checkUserSubscription();
        
        toast({
          title: 'Wallet connected',
          description: `Connected to ${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`,
        });
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    if (wallet) {
      try {
        await wallet.disconnect();
        setPublicKey(null);
        setIsConnected(false);
        setBalance(null);
        setIsSubscribed(false);
        
        toast({
          title: 'Wallet disconnected',
          description: 'Your wallet has been disconnected',
        });
      } catch (error: any) {
        console.error('Error disconnecting wallet:', error);
        toast({
          title: 'Disconnection failed',
          description: error.message || 'Failed to disconnect wallet',
          variant: 'destructive',
        });
      }
    }
  };

  // Sign transaction
  const signTransaction = async (transaction: any) => {
    if (!wallet || !isConnected) {
      throw new Error('Wallet not connected');
    }
    
    try {
      return await wallet.signTransaction(transaction);
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  };

  // Send transaction
  const sendTransaction = async (transaction: any) => {
    if (!wallet || !isConnected || !connection) {
      throw new Error('Wallet not connected');
    }
    
    try {
      // Sign the transaction
      const signedTx = await wallet.signTransaction(transaction);
      
      // Send the transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Confirm transaction
      await connection.confirmTransaction(signature);
      
      return signature;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  };

  // Context value
  const contextValue: SolanaWalletContextType = {
    publicKey,
    isConnected,
    balance,
    isSubscribed,
    connecting,
    connectWallet,
    disconnectWallet,
    signTransaction,
    sendTransaction,
    connection,
  };

  return (
    <SolanaWalletContext.Provider value={contextValue}>
      {children}
    </SolanaWalletContext.Provider>
  );
};

// Add this type definition for window to recognize wallet extensions
declare global {
  interface Window {
    phantom?: {
      solana?: any;
    };
    solflare?: any;
  }
}