import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import { serialize, deserialize } from 'borsh';

// Define the program ID (this will be determined when you deploy the program)
const PROGRAM_ID = 'PLACEHOLDER_PROGRAM_ID'; // Replace with your actual program ID after deployment

// Subscription fee in SOL
const SUBSCRIPTION_FEE = 10;
const LAMPORTS_PER_SOL = 1_000_000_000;

// Instruction enum for the subscription program
enum SubscriptionInstruction {
  PaySubscription = 0,
  WithdrawFees = 1,
  CheckSubscription = 2,
}

// Class representing the subscription account data
class SubscriptionAccount {
  is_subscribed: boolean;
  subscription_date: number;
  admin: Uint8Array;

  constructor(props: { is_subscribed: boolean; subscription_date: number; admin: Uint8Array }) {
    this.is_subscribed = props.is_subscribed;
    this.subscription_date = props.subscription_date;
    this.admin = props.admin;
  }

  static schema = new Map([
    [
      SubscriptionAccount,
      {
        kind: 'struct',
        fields: [
          ['is_subscribed', 'boolean'],
          ['subscription_date', 'i64'],
          ['admin', [32]],
        ],
      },
    ],
  ]);
}

// Instruction data for WithdrawFees
class WithdrawFeesData {
  instruction: number;
  amount: number;

  constructor(props: { instruction: number; amount: number }) {
    this.instruction = props.instruction;
    this.amount = props.amount;
  }

  static schema = new Map([
    [
      WithdrawFeesData,
      {
        kind: 'struct',
        fields: [
          ['instruction', 'u8'],
          ['amount', 'u64'],
        ],
      },
    ],
  ]);
}

/**
 * Find the PDA for a user's subscription account
 */
async function findSubscriptionAccount(userPubkey: PublicKey): Promise<[PublicKey, number]> {
  return await PublicKey.findProgramAddress(
    [Buffer.from('subscription'), userPubkey.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
}

/**
 * Pay the subscription fee for the Yield Aggregator platform
 */
export async function paySubscription(
  connection: Connection,
  userWallet: any, // Wallet interface
  adminPubkey: PublicKey
): Promise<string> {
  try {
    const userPubkey = userWallet.publicKey;
    
    // Find the user's subscription account PDA
    const [subscriptionAccount, _] = await findSubscriptionAccount(userPubkey);
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
        { pubkey: subscriptionAccount, isSigner: false, isWritable: true },
        { pubkey: adminPubkey, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey(PROGRAM_ID),
      data: Buffer.from([SubscriptionInstruction.PaySubscription]),
    });
    
    // Create and sign the transaction
    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPubkey;
    
    // Sign and send the transaction
    const signedTx = await userWallet.signTransaction(transaction);
    const txId = await connection.sendRawTransaction(signedTx.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(txId);
    
    return txId;
  } catch (error) {
    console.error('Error paying subscription:', error);
    throw error;
  }
}

/**
 * Check if a user has an active subscription
 */
export async function checkSubscription(
  connection: Connection,
  userPubkey: PublicKey
): Promise<boolean> {
  try {
    // Find the user's subscription account PDA
    const [subscriptionAccount, _] = await findSubscriptionAccount(userPubkey);
    
    // Get the subscription account data
    try {
      const accountInfo = await connection.getAccountInfo(subscriptionAccount);
      
      // If account doesn't exist, user isn't subscribed
      if (!accountInfo) {
        return false;
      }
      
      // Deserialize the account data
      const subscriptionData = deserialize(
        SubscriptionAccount.schema,
        SubscriptionAccount,
        accountInfo.data
      );
      
      return subscriptionData.is_subscribed;
    } catch (err) {
      // Account doesn't exist or other error
      return false;
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Withdraw fees (admin only)
 */
export async function withdrawFees(
  connection: Connection,
  adminKeypair: Keypair,
  amount: number
): Promise<string> {
  try {
    const adminPubkey = adminKeypair.publicKey;
    
    // Find the admin's subscription account
    const [subscriptionAccount, _] = await findSubscriptionAccount(adminPubkey);
    
    // Create instruction data
    const data = new WithdrawFeesData({
      instruction: SubscriptionInstruction.WithdrawFees,
      amount: amount * LAMPORTS_PER_SOL,
    });
    
    const instructionData = Buffer.from(serialize(WithdrawFeesData.schema, data));
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: adminPubkey, isSigner: true, isWritable: true },
        { pubkey: subscriptionAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey(PROGRAM_ID),
      data: instructionData,
    });
    
    // Create and sign the transaction
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = adminPubkey;
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Sign and send the transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [adminKeypair]);
    
    return signature;
  } catch (error) {
    console.error('Error withdrawing fees:', error);
    throw error;
  }
}