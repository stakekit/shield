import {
  PublicKey,
  StakeInstruction,
  StakeProgram,
  SystemInstruction,
} from '@solana/web3.js';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { isNonEmptyString } from '../../../utils/validation';
import { BaseValidator } from '../../base.validator';
import {
  createWithSeed,
  MEMO_PROGRAM_ID,
  STAKE_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  SYSVAR_CLOCK_ID,
  SYSVAR_RENT_ID,
  SYSVAR_STAKE_HISTORY_ID,
} from '../address';
import {
  decodeSolanaTransaction,
  findAccountMismatch,
  SolanaInstruction,
  toTransactionInstruction,
  tryDecode,
} from '../decode';
import {
  NATIVE_BENEFICIARY,
  NATIVE_PREPARE_FOR_REVOKE_COST_LAMPORTS,
  NATIVE_STAKE_AUTHORITY,
} from './constants';

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

/**
 * Validates transactions for Marinade Native staking: creating a stake
 * account delegated to Marinade's stake authority, paying the
 * prepare-for-revoke fee, and withdrawing from a deactivated stake account.
 */
export class MarinadeNativeValidator extends BaseValidator {
  getSupportedTransactionTypes(): TransactionType[] {
    return [
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

    switch (transactionType) {
      case TransactionType.STAKE:
        return this.validateStake(instructions, userAddress);
      case TransactionType.UNSTAKE:
        return this.validatePrepareForRevoke(instructions, userAddress);
      case TransactionType.WITHDRAW: {
        const receiver = isNonEmptyString(args?.receiverAddress)
          ? args.receiverAddress
          : userAddress;
        return this.validateWithdraw(instructions, userAddress, receiver);
      }
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  private validateStake(
    instructions: SolanaInstruction[],
    userAddress: string,
  ): ValidationResult {
    if (instructions.length !== 2) {
      return this.invalidCount(TransactionType.STAKE, 2, instructions);
    }
    const [create, initialize] = instructions;
    if (create.programId !== SYSTEM_PROGRAM_ID) {
      return this.blocked('Stake account creation is not a System instruction');
    }
    const created = tryDecode(() => {
      const instruction = toTransactionInstruction(create);
      if (
        SystemInstruction.decodeInstructionType(instruction) !==
        'CreateWithSeed'
      ) {
        throw new Error('not CreateAccountWithSeed');
      }
      return SystemInstruction.decodeCreateWithSeed(instruction);
    });
    if (!created.ok) {
      return this.blocked('Invalid stake account creation', {
        error: created.error,
      });
    }
    const { fromPubkey, basePubkey, seed, programId, space, lamports } =
      created.value;
    const stakeAccount = createWithSeed(userAddress, seed, STAKE_PROGRAM_ID);
    if (
      fromPubkey.toBase58() !== userAddress ||
      basePubkey.toBase58() !== userAddress
    ) {
      return this.blocked('Stake account is not funded and seeded by user');
    }
    if (programId.toBase58() !== STAKE_PROGRAM_ID) {
      return this.blocked('Created account is not owned by the Stake program');
    }
    if (space !== StakeProgram.space || BigInt(lamports) === 0n) {
      return this.blocked('Stake account has unexpected size or balance', {
        space,
        lamports,
      });
    }
    const createMismatch = findAccountMismatch(create, [
      userAddress,
      stakeAccount,
    ]);
    if (createMismatch) {
      return this.blocked('Created account does not match its seed', {
        ...createMismatch,
      });
    }
    return this.validateInitialize(initialize, userAddress, stakeAccount);
  }

  private validateInitialize(
    initialize: SolanaInstruction,
    userAddress: string,
    stakeAccount: string,
  ): ValidationResult {
    if (initialize.programId !== STAKE_PROGRAM_ID) {
      return this.blocked('Initialize is not a Stake program instruction');
    }
    const params = tryDecode(() => {
      const instruction = toTransactionInstruction(initialize);
      if (
        StakeInstruction.decodeInstructionType(instruction) !== 'Initialize'
      ) {
        throw new Error('not Initialize');
      }
      return StakeInstruction.decodeInitialize(instruction);
    });
    if (!params.ok) {
      return this.blocked('Invalid Initialize', { error: params.error });
    }
    const { authorized, lockup } = params.value;
    if (authorized.staker.toBase58() !== NATIVE_STAKE_AUTHORITY) {
      return this.blocked('Staker is not the Marinade stake authority', {
        staker: authorized.staker.toBase58(),
      });
    }
    if (authorized.withdrawer.toBase58() !== userAddress) {
      return this.blocked('Withdrawer is not user address');
    }
    if (
      lockup !== undefined &&
      (lockup.epoch !== 0 ||
        lockup.unixTimestamp !== 0 ||
        !lockup.custodian.equals(PublicKey.default))
    ) {
      return this.blocked('Stake account has a lockup');
    }
    return this.checkAccounts(initialize, 'Initialize', [
      stakeAccount,
      SYSVAR_RENT_ID,
    ]);
  }

  private validatePrepareForRevoke(
    instructions: SolanaInstruction[],
    userAddress: string,
  ): ValidationResult {
    if (instructions.length !== 2) {
      return this.invalidCount(TransactionType.UNSTAKE, 2, instructions);
    }
    const [fee, memo] = instructions;
    if (fee.programId !== SYSTEM_PROGRAM_ID) {
      return this.blocked('Fee payment is not a System instruction');
    }
    const transfer = tryDecode(() => {
      const instruction = toTransactionInstruction(fee);
      if (SystemInstruction.decodeInstructionType(instruction) !== 'Transfer') {
        throw new Error('not Transfer');
      }
      return SystemInstruction.decodeTransfer(instruction);
    });
    if (!transfer.ok) {
      return this.blocked('Invalid fee payment', { error: transfer.error });
    }
    if (
      BigInt(transfer.value.lamports) !==
      NATIVE_PREPARE_FOR_REVOKE_COST_LAMPORTS
    ) {
      return this.blocked('Fee payment amount does not match', {
        expected: NATIVE_PREPARE_FOR_REVOKE_COST_LAMPORTS.toString(),
        actual: transfer.value.lamports.toString(),
      });
    }
    const feeResult = this.checkAccounts(fee, 'Fee payment', [
      userAddress,
      NATIVE_BENEFICIARY,
    ]);
    if (!feeResult.isValid) return feeResult;

    return this.validateMemo(memo, userAddress);
  }

  private validateMemo(
    memo: SolanaInstruction,
    userAddress: string,
  ): ValidationResult {
    if (memo.programId !== MEMO_PROGRAM_ID) {
      return this.blocked('Second instruction is not a memo');
    }
    if (memo.accounts.length !== 0) {
      return this.blocked('Memo must not reference accounts');
    }
    const parsed = tryDecode<unknown>(() =>
      JSON.parse(memo.data.toString('utf8')),
    );
    const request = parsed.ok
      ? (parsed.value as { PrepareForRevoke?: unknown } | null)
          ?.PrepareForRevoke
      : undefined;
    if (typeof request !== 'object' || request === null) {
      return this.blocked('Memo is not a PrepareForRevoke request');
    }
    const { user, amount } = request as { user?: unknown; amount?: unknown };
    if (user !== userAddress) {
      return this.blocked('PrepareForRevoke user is not user address', {
        user,
      });
    }
    if (
      amount !== undefined &&
      (typeof amount !== 'string' || !POSITIVE_INTEGER.test(amount))
    ) {
      return this.blocked('PrepareForRevoke amount is not a positive integer', {
        amount,
      });
    }
    return this.safe();
  }

  private validateWithdraw(
    instructions: SolanaInstruction[],
    userAddress: string,
    receiverAddress: string,
  ): ValidationResult {
    if (instructions.length !== 1) {
      return this.invalidCount(TransactionType.WITHDRAW, 1, instructions);
    }
    const [withdraw] = instructions;
    if (withdraw.programId !== STAKE_PROGRAM_ID) {
      return this.blocked('Withdraw is not a Stake program instruction');
    }
    const params = tryDecode(() => {
      const instruction = toTransactionInstruction(withdraw);
      if (StakeInstruction.decodeInstructionType(instruction) !== 'Withdraw') {
        throw new Error('not Withdraw');
      }
      return StakeInstruction.decodeWithdraw(instruction);
    });
    if (!params.ok) {
      return this.blocked('Invalid Withdraw', { error: params.error });
    }
    if (BigInt(params.value.lamports) === 0n) {
      return this.blocked('Withdraw amount must be greater than zero');
    }
    return this.checkAccounts(withdraw, 'Withdraw', [
      null,
      receiverAddress,
      SYSVAR_CLOCK_ID,
      SYSVAR_STAKE_HISTORY_ID,
      userAddress,
    ]);
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
    expected: number,
    instructions: SolanaInstruction[],
  ): ValidationResult {
    return this.blocked(`Invalid instruction count for ${transactionType}`, {
      expected,
      actual: instructions.length,
    });
  }
}
