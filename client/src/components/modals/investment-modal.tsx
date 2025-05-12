import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YieldOpportunity } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: YieldOpportunity;
}

export const InvestmentModal = ({ isOpen, onClose, opportunity }: InvestmentModalProps) => {
  const [amount, setAmount] = useState("100.00");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const balanceData = {
    balance: 1245.00,
    currency: "USDC"
  };

  const balancePercentage = (parseFloat(amount) / balanceData.balance) * 100;
  const estimatedYield = (parseFloat(amount) * parseFloat(opportunity.apy.toString())) / 100;
  const depositFee = (parseFloat(amount) * parseFloat(opportunity.depositFee.toString())) / 100;

  const investMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/portfolio/invest', {
        opportunityId: opportunity.id,
        amount: parseFloat(amount),
        token: balanceData.currency
      });
    },
    onSuccess: () => {
      toast({
        title: "Investment successful",
        description: `You have successfully invested ${amount} ${balanceData.currency} in ${opportunity.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/info'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Investment failed",
        description: error.message || "There was an error processing your investment",
        variant: "destructive"
      });
    }
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleInvest = () => {
    if (parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid investment amount",
        variant: "destructive"
      });
      return;
    }
    
    if (parseFloat(amount) > balanceData.balance) {
      toast({
        title: "Insufficient balance",
        description: `Your balance of ${balanceData.balance} ${balanceData.currency} is not enough`,
        variant: "destructive"
      });
      return;
    }
    
    investMutation.mutate();
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'medium-high':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invest in {opportunity.name}</DialogTitle>
          <DialogDescription>
            Enter the amount you want to invest
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-background rounded-lg mb-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Protocol</span>
            <span className="text-sm text-card-foreground">{opportunity.protocol}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Current APY</span>
            <span className="text-sm text-primary font-semibold">{opportunity.apy}%</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Risk Level</span>
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskBadgeColor(opportunity.riskLevel)}`}>
              {opportunity.riskLevel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Deposit Fee</span>
            <span className="text-sm text-card-foreground">{opportunity.depositFee}%</span>
          </div>
        </div>
        
        <div className="mb-4">
          <Label htmlFor="amount" className="block text-sm font-medium text-muted-foreground mb-2">
            Investment Amount
          </Label>
          <div className="relative">
            <Input
              id="amount"
              type="text"
              value={amount}
              onChange={handleAmountChange}
              className="pr-16"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-muted-foreground">{balanceData.currency}</span>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Your Balance</span>
            <span className="text-sm text-card-foreground">{balanceData.balance.toFixed(2)} {balanceData.currency}</span>
          </div>
          <div className="w-full bg-background rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(balancePercentage, 100)}%` }}></div>
          </div>
        </div>
        
        <div className="mb-6 p-3 bg-background rounded-lg border border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Estimated Annual Yield</span>
            <span className="text-sm text-primary font-semibold">+{estimatedYield.toFixed(2)} {balanceData.currency}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Deposit Fee</span>
            <span className="text-sm text-red-400">-{depositFee.toFixed(2)} {balanceData.currency}</span>
          </div>
        </div>
        
        <DialogFooter className="flex space-x-2 sm:space-x-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleInvest} 
            disabled={investMutation.isPending}
          >
            {investMutation.isPending ? "Processing..." : "Confirm Investment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
