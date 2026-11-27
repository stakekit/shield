import { SystemInstruction } from '@solana/web3.js';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { matchesDeclaredAmount } from '../../../utils/amount';
import { isNonEmptyString } from '../../../utils/validation';
import { BaseValidator } from '../../base.validator';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  createWithSeed,
  SYSTEM_PROGRAM_ID,
  SYSVAR_CLOCK_ID,
  SYSVAR_RENT_ID,
  TOKEN_PROGRAM_ID,
} from '../address';
import {
  decodeSolanaTransaction,
  findAccountMismatch,
  readCreateWithSeedLamports,
  SolanaInstruction,
  toTransactionInstruction,
  tryDecode,
} from '../decode';
import {
  LIQ_POOL_MSOL_LEG,
  LIQ_POOL_MSOL_LEG_AUTHORITY_PDA,
  LIQ_POOL_SOL_LEG_PDA,
  MARINADE_DISCRIMINATORS,
  MARINADE_PROGRAM_ID,
  MARINADE_STATE,
  MARINADE_TICKET_ACCOUNT_SPACE,
  MARINADE_TICKET_MAX_LAMPORTS,
  MSOL_MINT,
  MSOL_MINT_AUTHORITY_PDA,
  RESERVE_PDA,
} from './constants';

const AMOUNT_INSTRUCTION_LENGTH = 16;
const BASE_UNITS = /^[0-9]+$/;
const DISCRIMINATOR_LENGTH = 8;

/**
 * Validates transactions for Marinade liquid staking (mSOL):
 * token account creation, deposit, liquid and delayed unstake, and ticket claim.
 */
export class MarinadeMsolValidator extends BaseValidator {
  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.CREATE_ACCOUNT,
      TransactionType.STAKE,
      TransactionType.UNSTAKE,
      TransactionType.WITHDRAW,
    ];
  }

  validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    args?: ActionArguments,
    _context?: ValidationContext,
  ): ValidationResult {
    const decoded = decodeSolanaTransaction(unsignedTransaction);
    if (!decoded.ok) {
      return this.blocked('Failed to decode Solana transaction', {
        error: decoded.error,
      });
    }
    const { feePayer, instructions } = decoded.tx;
    if (feePayer !== userAddress) {
      return this.blocked('Fee payer is not user address', { feePayer });
    }
    const declaredAmount = isNonEmptyString(args?.amount)
      ? args.amount
      : undefined;
    if (declaredAmount !== undefined && !BASE_UNITS.test(declaredAmount)) {
      return this.blocked('Declared amount is not an integer in base units', {
        declared: declaredAmount,
      });
    }

    switch (transactionType) {
      case TransactionType.CREATE_ACCOUNT:
        return this.validateCreateAccount(instructions, userAddress);
      case TransactionType.STAKE:
        return this.validateDeposit(instructions, userAddress, declaredAmount);
      case TransactionType.UNSTAKE:
        return instructions.length === 1
          ? this.validateLiquidUnstake(
              instructions,
              userAddress,
              declaredAmount,
            )
          : this.validateOrderUnstake(
              instructions,
              userAddress,
              declaredAmount,
            );
      case TransactionType.WITHDRAW:
        return this.validateClaim(instructions, userAddress);
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  private validateCreateAccount(
    instructions: SolanaInstruction[],
    userAddress: string,
  ): ValidationResult {
    if (instructions.length !== 1) {
      return this.invalidCount(TransactionType.CREATE_ACCOUNT, 1, instructions);
    }
    const [create] = instructions;
    if (create.programId !== ASSOCIATED_TOKEN_PROGRAM_ID) {
      return this.blocked(
        'Instruction is not an associated token account create',
      );
    }
    if (create.data.length !== 0) {
      return this.blocked(
        'Associated token account create has unexpected data',
      );
    }
    return this.checkAccounts(create, 'Associated token account create', [
      userAddress,
      associatedTokenAddress(userAddress, MSOL_MINT),
      userAddress,
      MSOL_MINT,
      SYSTEM_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
    ]);
  }

  private validateDeposit(
    instructions: SolanaInstruction[],
    userAddress: string,
    declaredAmount: string | undefined,
  ): ValidationResult {
    if (instructions.length !== 1) {
      return this.invalidCount(TransactionType.STAKE, 1, instructions);
    }
    const [deposit] = instructions;
    const dataError = this.checkAmountInstruction(
      deposit,
      MARINADE_DISCRIMINATORS.deposit,
      declaredAmount,
    );
    if (dataError !== undefined)
      return this.blocked(`Invalid deposit: ${dataError}`);

    return this.checkAccounts(deposit, 'Deposit', [
      MARINADE_STATE,
      MSOL_MINT,
      LIQ_POOL_SOL_LEG_PDA,
      LIQ_POOL_MSOL_LEG,
      LIQ_POOL_MSOL_LEG_AUTHORITY_PDA,
      RESERVE_PDA,
      userAddress,
      associatedTokenAddress(userAddress, MSOL_MINT),
      MSOL_MINT_AUTHORITY_PDA,
      SYSTEM_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
    ]);
  }

  private validateLiquidUnstake(
    instructions: SolanaInstruction[],
    userAddress: string,
    declaredAmount: string | undefined,
  ): ValidationResult {
    const [unstake] = instructions;
    const dataError = this.checkAmountInstruction(
      unstake,
      MARINADE_DISCRIMINATORS.liquidUnstake,
      declaredAmount,
    );
    if (dataError !== undefined)
      return this.blocked(`Invalid liquid unstake: ${dataError}`);

    // The treasury account (index 4) is checked by the Marinade program
    // against its on-chain state, so it is not pinned here.
    return this.checkAccounts(unstake, 'Liquid unstake', [
      MARINADE_STATE,
      MSOL_MINT,
      LIQ_POOL_SOL_LEG_PDA,
      LIQ_POOL_MSOL_LEG,
      null,
      associatedTokenAddress(userAddress, MSOL_MINT),
      userAddress,
      userAddress,
      SYSTEM_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
    ]);
  }

  private validateOrderUnstake(
    instructions: SolanaInstruction[],
    userAddress: string,
    declaredAmount: string | undefined,
  ): ValidationResult {
    if (instructions.length !== 2) {
      return this.invalidCount(TransactionType.UNSTAKE, '1 or 2', instructions);
    }
    const [createTicket, orderUnstake] = instructions;
    const ticket = this.decodeTicketCreation(createTicket, userAddress);
    if (typeof ticket !== 'string') return ticket;

    const dataError = this.checkAmountInstruction(
      orderUnstake,
      MARINADE_DISCRIMINATORS.orderUnstake,
      declaredAmount,
    );
    if (dataError !== undefined)
      return this.blocked(`Invalid order unstake: ${dataError}`);

    return this.checkAccounts(orderUnstake, 'Order unstake', [
      MARINADE_STATE,
      MSOL_MINT,
      associatedTokenAddress(userAddress, MSOL_MINT),
      userAddress,
      ticket,
      SYSVAR_CLOCK_ID,
      SYSVAR_RENT_ID,
      TOKEN_PROGRAM_ID,
    ]);
  }

  /** Returns the ticket account address, or a blocked result. */
  private decodeTicketCreation(
    instruction: SolanaInstruction,
    userAddress: string,
  ): string | ValidationResult {
    if (instruction.programId !== SYSTEM_PROGRAM_ID) {
      return this.blocked(
        'Ticket creation is not a System program instruction',
      );
    }
    const decoded = tryDecode(() => {
      const transactionInstruction = toTransactionInstruction(instruction);
      if (
        SystemInstruction.decodeInstructionType(transactionInstruction) !==
        'CreateWithSeed'
      ) {
        throw new Error('not CreateAccountWithSeed');
      }
      return SystemInstruction.decodeCreateWithSeed(transactionInstruction);
    });
    if (!decoded.ok) {
      return this.blocked('Invalid ticket creation', { error: decoded.error });
    }
    const params = decoded.value;

    const ticket = createWithSeed(
      userAddress,
      params.seed,
      MARINADE_PROGRAM_ID,
    );
    if (
      params.fromPubkey.toBase58() !== userAddress ||
      params.basePubkey.toBase58() !== userAddress
    ) {
      return this.blocked('Ticket creation is not funded and seeded by user');
    }
    if (params.programId.toBase58() !== MARINADE_PROGRAM_ID) {
      return this.blocked(
        'Ticket account is not owned by the Marinade program',
      );
    }
    if (BigInt(params.space) !== MARINADE_TICKET_ACCOUNT_SPACE) {
      return this.blocked('Ticket account has unexpected size', {
        space: params.space,
      });
    }
    const lamports = readCreateWithSeedLamports(instruction);
    if (lamports > MARINADE_TICKET_MAX_LAMPORTS) {
      return this.blocked('Ticket account is funded above its rent', {
        lamports: lamports.toString(),
      });
    }
    if (params.newAccountPubkey.toBase58() !== ticket) {
      return this.blocked('Ticket account does not match its seed');
    }
    return ticket;
  }

  private validateClaim(
    instructions: SolanaInstruction[],
    userAddress: string,
  ): ValidationResult {
    if (instructions.length !== 1) {
      return this.invalidCount(TransactionType.WITHDRAW, 1, instructions);
    }
    const [claim] = instructions;
    if (claim.programId !== MARINADE_PROGRAM_ID) {
      return this.blocked('Claim is not a Marinade instruction');
    }
    if (
      claim.data.length !== DISCRIMINATOR_LENGTH ||
      !claim.data.equals(MARINADE_DISCRIMINATORS.claim)
    ) {
      return this.blocked('Invalid claim instruction data');
    }

    // Marinade pays the claim to the ticket beneficiary, which is the user
    // who ordered the unstake, so the receiver is always the user.
    return this.checkAccounts(claim, 'Claim', [
      MARINADE_STATE,
      RESERVE_PDA,
      null,
      userAddress,
      SYSVAR_CLOCK_ID,
      SYSTEM_PROGRAM_ID,
    ]);
  }

  /** Returns an error message, or undefined when the data is valid. */
  private checkAmountInstruction(
    instruction: SolanaInstruction,
    discriminator: Buffer,
    declaredAmount: string | undefined,
  ): string | undefined {
    if (instruction.programId !== MARINADE_PROGRAM_ID) {
      return 'not a Marinade instruction';
    }
    const { data } = instruction;
    if (data.length !== AMOUNT_INSTRUCTION_LENGTH) {
      return `expected ${AMOUNT_INSTRUCTION_LENGTH} bytes of data, got ${data.length}`;
    }
    if (!data.subarray(0, DISCRIMINATOR_LENGTH).equals(discriminator)) {
      return 'unexpected discriminator';
    }
    const amount = data.readBigUInt64LE(DISCRIMINATOR_LENGTH);
    if (amount === 0n) {
      return 'amount must be greater than zero';
    }
    if (!matchesDeclaredAmount(amount, declaredAmount)) {
      return `amount ${amount} does not match declared amount ${declaredAmount}`;
    }
    return undefined;
  }

  private checkAccounts(
    instruction: SolanaInstruction,
    label: string,
    expected: ReadonlyArray<string | null>,
  ): ValidationResult {
    const mismatch = findAccountMismatch(instruction, expected);
    if (mismatch) {
      return this.blocked(`${label} accounts do not match`, mismatch);
    }
    return this.safe();
  }

  private invalidCount(
    transactionType: TransactionType,
    expected: number | string,
    instructions: SolanaInstruction[],
  ): ValidationResult {
    return this.blocked(`Invalid instruction count for ${transactionType}`, {
      expected,
      actual: instructions.length,
    });
  }
}
