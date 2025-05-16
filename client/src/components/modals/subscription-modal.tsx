import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSolanaWallet, ADMIN_PUBKEY } from "@/contexts/SolanaWalletContext";
import { paySubscription, SUBSCRIPTION_CURRENCY } from "@/lib/subscription";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionModal = ({ isOpen, onClose }: SubscriptionModalProps) => {
  const { toast } = useToast();
  const { connectWallet, isConnected, publicKey, balance, isSubscribed, connection, connecting } = useSolanaWallet();
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscription fee is 10 USDC
  const SUBSCRIPTION_FEE = 10;

  // Check if the user has enough balance
  const hasEnoughBalance = balance !== null && balance >= SUBSCRIPTION_FEE;

  // Close the modal if the user is already subscribed
  useEffect(() => {
    if (isSubscribed) {
      toast({
        title: "Already subscribed",
        description: "You already have an active subscription to the platform",
      });
      onClose();
    }
  }, [isSubscribed, onClose, toast]);

  const handleSubscribe = async () => {
    if (!isConnected || !publicKey || !connection) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!hasEnoughBalance) {
      toast({
        title: "Insufficient balance",
        description: `You need at least ${SUBSCRIPTION_FEE} ${SUBSCRIPTION_CURRENCY} to subscribe`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Call the paySubscription function from our contract client
      const txSignature = await paySubscription(
        connection,
        // Pass the wallet instance that has signTransaction method
        // This will be provided by Phantom, Solflare, etc.
        window.phantom?.solana || window.solflare,
        ADMIN_PUBKEY
      );

      // Record the subscription in our database
      const response = await fetch('/api/wallet/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          transactionHash: txSignature,
          amount: SUBSCRIPTION_FEE,
          currency: SUBSCRIPTION_CURRENCY
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record subscription in database');
      }

      toast({
        title: "Subscription successful!",
        description: `Transaction ID: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}`,
      });

      // Close the modal
      onClose();
    } catch (error: any) {
      console.error("Error paying subscription:", error);
      toast({
        title: "Subscription failed",
        description: error.message || "Error processing your subscription",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to Sol YieldHunter</DialogTitle>
          <DialogDescription>
            A one-time payment of 10 {SUBSCRIPTION_CURRENCY} is required to use the yield aggregator platform.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-background rounded-lg mb-4 border border-border">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-sidebar-accent to-sidebar-primary flex items-center justify-center text-white font-bold text-xl mr-4">
              SY
            </div>
            <div>
              <h3 className="text-md font-semibold text-card-foreground">Sol YieldHunter Platform</h3>
              <p className="text-sm text-muted-foreground">Premium Solana Yield Aggregation Service</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subscription Fee</span>
              <span className="text-sm font-semibold text-primary">10 {SUBSCRIPTION_CURRENCY}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Payment</span>
              <span className="text-sm text-card-foreground">One-time fee</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Access</span>
              <span className="text-sm text-card-foreground">Unlimited</span>
            </div>
          </div>
        </div>

        <div className="mb-6 p-3 bg-background rounded-lg border border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Wallet Status</span>
            <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          {isConnected && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Address</span>
                <span className="text-sm font-mono text-card-foreground">
                  {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Balance</span>
                <span className={`text-sm ${hasEnoughBalance ? 'text-green-400' : 'text-red-400'}`}>
                  {balance?.toFixed(2) || '0'} {SUBSCRIPTION_CURRENCY}
                </span>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onClose} className="mb-2 sm:mb-0">
            Cancel
          </Button>
          {!isConnected ? (
            <Button 
              variant="default" 
              onClick={connectWallet}
              disabled={connecting}
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          ) : (
            <Button 
              variant="default"
              onClick={handleSubscribe}
              disabled={isProcessing || !hasEnoughBalance}
            >
              {isProcessing ? "Processing..." : hasEnoughBalance ? `Pay 10 ${SUBSCRIPTION_CURRENCY}` : "Insufficient Balance"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};