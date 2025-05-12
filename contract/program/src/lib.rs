use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    program::{invoke, invoke_signed},
    sysvar::Sysvar,
};

// Define the entrypoint that all Solana programs must have
entrypoint!(process_instruction);

// Program ID: this will be determined when you deploy the program
// solana_program::declare_id!("your_program_id_here");

// Subscription fee in lamports (10 SOL = 10 * 10^9 lamports)
const SUBSCRIPTION_FEE: u64 = 10_000_000_000;

// Instruction enum for our program
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum SubscriptionInstruction {
    // Pay the subscription fee
    PaySubscription,
    // Admin can withdraw collected fees
    WithdrawFees { amount: u64 },
    // Check if wallet has an active subscription
    CheckSubscription,
}

// Subscription state stored in an account
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct SubscriptionAccount {
    pub is_subscribed: bool,
    pub subscription_date: i64,
    pub admin: Pubkey,
}

// Main instruction processor function
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Deserialize the instruction data
    let instruction = SubscriptionInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        SubscriptionInstruction::PaySubscription => {
            pay_subscription(program_id, accounts)
        }
        SubscriptionInstruction::WithdrawFees { amount } => {
            withdraw_fees(program_id, accounts, amount)
        }
        SubscriptionInstruction::CheckSubscription => {
            check_subscription(program_id, accounts)
        }
    }
}

// Process the PaySubscription instruction
fn pay_subscription(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Get accounts from the transaction
    let user = next_account_info(accounts_iter)?;
    let subscription_account = next_account_info(accounts_iter)?;
    let admin_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Ensure the user signed the transaction
    if !user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check if the subscription account belongs to our program
    if subscription_account.owner != program_id {
        // If it doesn't, we need to create the account
        let rent = Rent::get()?;
        let space = std::mem::size_of::<SubscriptionAccount>();
        let rent_lamports = rent.minimum_balance(space);
        
        // Create the subscription account
        invoke(
            &system_instruction::create_account(
                user.key,
                subscription_account.key,
                rent_lamports,
                space as u64,
                program_id,
            ),
            &[user.clone(), subscription_account.clone(), system_program.clone()],
        )?;
        
        // Initialize the subscription account data
        let subscription_data = SubscriptionAccount {
            is_subscribed: false,
            subscription_date: 0,
            admin: *admin_account.key,
        };
        
        subscription_data.serialize(&mut &mut subscription_account.data.borrow_mut()[..])?;
    }
    
    // Transfer the subscription fee to the admin
    invoke(
        &system_instruction::transfer(
            user.key,
            admin_account.key,
            SUBSCRIPTION_FEE,
        ),
        &[user.clone(), admin_account.clone(), system_program.clone()],
    )?;
    
    // Update the subscription account to show the user has paid
    let mut subscription_data = SubscriptionAccount::try_from_slice(&subscription_account.data.borrow())?;
    subscription_data.is_subscribed = true;
    subscription_data.subscription_date = solana_program::clock::Clock::get()?.unix_timestamp;
    subscription_data.serialize(&mut &mut subscription_account.data.borrow_mut()[..])?;
    
    msg!("Subscription payment successful!");
    Ok(())
}

// Process the WithdrawFees instruction
fn withdraw_fees(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Get accounts from the transaction
    let admin = next_account_info(accounts_iter)?;
    let subscription_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Ensure the admin signed the transaction
    if !admin.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Verify the admin is authorized by checking the stored admin key
    let subscription_data = SubscriptionAccount::try_from_slice(&subscription_account.data.borrow())?;
    if subscription_data.admin != *admin.key {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Calculate available balance
    let balance = **subscription_account.lamports.borrow();
    let rent = Rent::get()?;
    let minimum_balance = rent.minimum_balance(subscription_account.data_len());
    
    // Ensure we keep enough for rent exemption
    if balance - amount < minimum_balance {
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Transfer the specified amount to the admin
    **subscription_account.lamports.borrow_mut() -= amount;
    **admin.lamports.borrow_mut() += amount;
    
    msg!("Fees withdrawn successfully!");
    Ok(())
}

// Process the CheckSubscription instruction
fn check_subscription(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    
    // Get accounts from the transaction
    let user = next_account_info(accounts_iter)?;
    let subscription_account = next_account_info(accounts_iter)?;
    
    // Check if subscription account exists and belongs to our program
    if subscription_account.owner != program_id {
        msg!("Not subscribed: Subscription account not found");
        return Ok(());
    }
    
    // Check if user is subscribed
    let subscription_data = SubscriptionAccount::try_from_slice(&subscription_account.data.borrow())?;
    if subscription_data.is_subscribed {
        msg!("Subscription active. Subscription date: {}", subscription_data.subscription_date);
    } else {
        msg!("Not subscribed: Subscription not active");
    }
    
    Ok(())
}