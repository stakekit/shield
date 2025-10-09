import {
  AccountMeta,
  PublicKey,
  StakeInstruction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { isNonEmptyString, isNullOrUndefined } from '../../../utils/validation';
import { BaseValidator } from '../../base.validator';

type DecodedInstruction = {
  programId: string;
  instructionType: string; // Decoded from data[0]
  data: Buffer;
  accounts: Array<AccountMeta>;
};

export class SolanaNativeStakingValidator extends BaseValidator {
  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.STAKE,
      TransactionType.UNSTAKE,
      TransactionType.WITHDRAW,
      TransactionType.WITHDRAW_ALL,
      TransactionType.SPLIT,
    ];
  }
  validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    args?: ActionArguments,
    _context?: ValidationContext,
  ): ValidationResult {
    const decoded = this.decodeSolanaTransaction(unsignedTransaction);
    if (!decoded.isValid) {
      return this.blocked('Failed to decode Solana transaction', {
        error: decoded.error,
      });
    }

    const instructions = decoded.instructions!;

    switch (transactionType) {
      case TransactionType.STAKE:
        return this.validateStake(instructions, userAddress, args);
      case TransactionType.UNSTAKE:
        return this.validateUnstake(instructions, userAddress);
      case TransactionType.WITHDRAW:
        return this.validateWithdraw(instructions, userAddress);
      case TransactionType.WITHDRAW_ALL:
        return this.validateWithdrawAll(instructions, userAddress);
      case TransactionType.SPLIT:
        return this.validateSplit(instructions, userAddress);
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  private validateStake(
    instructions: DecodedInstruction[],
    userAddress: string,
    args?: ActionArguments,
  ): ValidationResult {
    const expectedCount = 5;

    if (instructions.length !== expectedCount) {
      return this.blocked('Invalid instruction count for STAKE', {
        expected: expectedCount,
        actual: instructions.length,
      });
    }

    let idx = 0;

    if (
      !this.isComputeBudgetInstruction(
        instructions[idx++],
        'SetComputeUnitLimit',
      )
    ) {
      return this.blocked('Missing or invalid SetComputeUnitLimit');
    }
    if (
      !this.isComputeBudgetInstruction(
        instructions[idx++],
        'SetComputeUnitPrice',
      )
    ) {
      return this.blocked('Missing or invalid SetComputeUnitPrice');
    }

    const createAccountWithSeedInstruction = instructions[idx++];
    if (
      !this.isSystemInstruction(
        createAccountWithSeedInstruction,
        'CreateAccountWithSeed',
      )
    ) {
      return this.blocked('Missing or invalid CreateAccountWithSeed');
    }

    const newStakeAccount = createAccountWithSeedInstruction.accounts
      .at(1)
      ?.pubkey.toBase58();
    if (
      createAccountWithSeedInstruction.accounts.at(0)?.pubkey.toBase58() !==
      userAddress
    ) {
      return this.blocked('CreateAccountWithSeed source is not user address');
    }

    const initialize = instructions[idx++];
    if (!this.isStakeInstruction(initialize, 'Initialize')) {
      return this.blocked('Missing or invalid Initialize');
    }

    if (!this.isStakeAccountAuthorizationInstruction(initialize, userAddress)) {
      return this.blocked('Missing or invalid withdrawer authorization');
    }

    if (initialize.accounts.at(0)?.pubkey.toBase58() !== newStakeAccount) {
      return this.blocked(
        'Initialize stake account does not match new stake account',
      );
    }

    const delegate = instructions[idx];
    if (!this.isStakeInstruction(delegate, 'Delegate')) {
      return this.blocked('Missing or invalid Delegate instruction');
    }

    if (delegate.accounts.at(0)?.pubkey.toBase58() !== newStakeAccount) {
      return this.blocked(
        'Delegate stake account does not match new stake account',
      );
    }

    if (delegate.accounts.at(5)?.pubkey.toBase58() !== userAddress) {
      return this.blocked('Delegate authority is not user address');
    }

    if (!isNullOrUndefined(args) && isNonEmptyString(args.validatorAddress)) {
      const voteAccount = delegate.accounts.at(1)?.pubkey.toBase58();
      if (voteAccount !== args.validatorAddress) {
        return this.blocked('Validator address does not match expected', {
          expected: args.validatorAddress,
          actual: voteAccount,
        });
      }
    }

    return this.safe();
  }

  private validateUnstake(
    instructions: DecodedInstruction[],
    userAddress: string,
  ): ValidationResult {
    const minInstructions = 3;
    const maxInstructions = 12;

    if (
      instructions.length < minInstructions ||
      instructions.length > maxInstructions
    ) {
      return this.blocked('Invalid instruction count for UNSTAKE', {
        expectedRange: `${minInstructions}-${maxInstructions}`,
        actual: instructions.length,
      });
    }

    if (
      !this.isComputeBudgetInstruction(instructions[0], 'SetComputeUnitLimit')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitLimit');
    }
    if (
      !this.isComputeBudgetInstruction(instructions[1], 'SetComputeUnitPrice')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitPrice');
    }

    for (let i = 2; i < instructions.length; i++) {
      const deactivate = instructions[i];
      if (!this.isStakeInstruction(deactivate, 'Deactivate')) {
        return this.blocked(
          `Instruction ${i} must be a Deactivate instruction`,
          {
            actual: deactivate.instructionType,
          },
        );
      }
      if (deactivate.accounts.at(2)?.pubkey.toBase58() !== userAddress) {
        return this.blocked(
          `Deactivate authority for instruction ${i} is not user address`,
        );
      }
    }

    return this.safe();
  }

  private validateWithdraw(
    instructions: DecodedInstruction[],
    userAddress: string,
  ): ValidationResult {
    if (instructions.length !== 3) {
      return this.blocked('Invalid instruction count for WITHDRAW', {
        expected: 3,
        actual: instructions.length,
      });
    }

    if (
      !this.isComputeBudgetInstruction(instructions[0], 'SetComputeUnitLimit')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitLimit');
    }
    if (
      !this.isComputeBudgetInstruction(instructions[1], 'SetComputeUnitPrice')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitPrice');
    }

    const withdraw = instructions[2];
    if (!this.isStakeInstruction(withdraw, 'Withdraw')) {
      return this.blocked('Missing or invalid Withdraw instruction');
    }
    if (withdraw.accounts.at(1)?.pubkey.toBase58() !== userAddress) {
      return this.blocked('Withdraw recipient is not user address');
    }
    if (withdraw.accounts.at(4)?.pubkey.toBase58() !== userAddress) {
      return this.blocked('Withdraw authority is not user address');
    }

    return this.safe();
  }

  private validateWithdrawAll(
    instructions: DecodedInstruction[],
    userAddress: string,
  ): ValidationResult {
    if (instructions.length < 4) {
      return this.blocked('Invalid instruction count for WITHDRAW_ALL', {
        expected: 3,
        actual: instructions.length,
      });
    }

    if (
      !this.isComputeBudgetInstruction(instructions[0], 'SetComputeUnitLimit')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitLimit');
    }
    if (
      !this.isComputeBudgetInstruction(instructions[1], 'SetComputeUnitPrice')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitPrice');
    }

    for (let i = 2; i < instructions.length; i++) {
      const withdraw = instructions[i];
      if (!this.isStakeInstruction(withdraw, 'Withdraw')) {
        return this.blocked('Missing or invalid Withdraw instruction');
      }
      if (withdraw.accounts.at(1)?.pubkey.toBase58() !== userAddress) {
        return this.blocked('Withdraw recipient is not user address');
      }
      if (withdraw.accounts.at(4)?.pubkey.toBase58() !== userAddress) {
        return this.blocked('Withdraw authority is not user address');
      }
    }

    return this.safe();
  }

  private validateSplit(
    instructions: DecodedInstruction[],
    userAddress: string,
  ): ValidationResult {
    if (instructions.length !== 6) {
      return this.blocked('Invalid instruction count for SPLIT', {
        expected: 6,
        actual: instructions.length,
      });
    }

    if (
      !this.isComputeBudgetInstruction(instructions[0], 'SetComputeUnitLimit')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitLimit');
    }
    if (
      !this.isComputeBudgetInstruction(instructions[1], 'SetComputeUnitPrice')
    ) {
      return this.blocked('Missing or invalid SetComputeUnitPrice');
    }

    const allocateWithSeed = instructions[2];
    if (!this.isSystemInstruction(instructions[2], 'AllocateWithSeed')) {
      return this.blocked('Missing or invalid AllocateWithSeed');
    }

    const newStakeAccount = allocateWithSeed.accounts.at(0)?.pubkey.toBase58();
    if (allocateWithSeed.accounts.at(1)?.pubkey.toBase58() !== userAddress) {
      return this.blocked('AllocateWithSeed source is not user address');
    }

    const transfer = instructions[3];
    if (!this.isSystemInstruction(transfer, 'Transfer')) {
      return this.blocked('Missing or invalid Transfer');
    }
    if (transfer.accounts.at(0)?.pubkey.toBase58() !== userAddress) {
      return this.blocked('Transfer not from user address');
    }
    if (transfer.accounts.at(1)?.pubkey.toBase58() !== newStakeAccount) {
      return this.blocked(
        'Transfer recipient does not match new stake account',
      );
    }

    const split = instructions[4];
    if (!this.isStakeInstruction(split, 'Split')) {
      return this.blocked('Missing or invalid Split instruction');
    }
    if (split.accounts.at(1)?.pubkey.toBase58() !== newStakeAccount) {
      return this.blocked(
        'Split stake account does not match new stake account',
      );
    }
    if (split.accounts.at(2)?.pubkey.toBase58() !== userAddress) {
      return this.blocked('Split authority is not user address');
    }

    const transferRecipient = transfer.accounts.at(1)?.pubkey;
    const splitNewStake = split.accounts.at(1)?.pubkey;
    if (
      transferRecipient &&
      splitNewStake &&
      transferRecipient.toBase58() !== splitNewStake.toBase58()
    ) {
      return this.blocked(
        'Transfer recipient does not match Split stake account',
        {
          transferRecipient,
          splitStakeAccount: splitNewStake,
        },
      );
    }

    const deactivate = instructions[5];

    if (!this.isStakeInstruction(deactivate, 'Deactivate')) {
      return this.blocked('Missing or invalid Deactivate instruction');
    }

    if (deactivate.accounts.at(0)?.pubkey.toBase58() !== newStakeAccount) {
      return this.blocked(
        'Deactivate stake account does not match new stake account',
      );
    }
    if (deactivate.accounts.at(2)?.pubkey.toBase58() !== userAddress) {
      return this.blocked('Deactivate authority is not user address');
    }

    return this.safe();
  }

  private isComputeBudgetInstruction(
    instruction: DecodedInstruction,
    expectedType: string,
  ): boolean {
    return (
      instruction.programId === 'ComputeBudget111111111111111111111111111111' &&
      instruction.instructionType === expectedType
    );
  }

  private isSystemInstruction(
    instruction: DecodedInstruction,
    expectedType: string,
  ): boolean {
    return (
      instruction.programId === '11111111111111111111111111111111' &&
      instruction.instructionType === expectedType
    );
  }

  private isStakeInstruction(
    instruction: DecodedInstruction,
    expectedType: string,
  ): boolean {
    return (
      instruction.programId === 'Stake11111111111111111111111111111111111111' &&
      instruction.instructionType === expectedType
    );
  }

  private isStakeAccountAuthorizationInstruction(
    instruction: DecodedInstruction,
    expectedWithdrawer: string,
  ): boolean {
    const initializeInstruction = StakeInstruction.decodeInitialize({
      keys: instruction.accounts,
      programId: new PublicKey(instruction.programId),
      data: instruction.data,
    });

    return (
      initializeInstruction.authorized.staker.toBase58() ===
        expectedWithdrawer &&
      initializeInstruction.authorized.withdrawer.toBase58() ===
        expectedWithdrawer
    );
  }

  private getSolanaInstructionType(
    instruction: TransactionInstruction,
  ): string {
    const programId = instruction.programId.toBase58();
    const data = instruction.data;
    if (
      programId === 'Stake11111111111111111111111111111111111111' &&
      data.length > 0
    ) {
      switch (data[0]) {
        case 0:
          return 'Initialize';
        case 1:
          return 'Authorize';
        case 2:
          return 'Delegate';
        case 3:
          return 'Split';
        case 4:
          return 'Withdraw';
        case 5:
          return 'Deactivate';
        case 10:
          return 'CreateAccountWithSeed';
        default:
          return 'Unknown';
      }
    } else if (
      programId === '11111111111111111111111111111111' &&
      data.length > 0
    ) {
      switch (data[0]) {
        case 0:
          return 'CreateAccount';
        case 1:
          return 'Assign';
        case 2:
          return 'Transfer';
        case 3:
          return 'CreateAccountWithSeed';
        case 8:
          return 'Allocate';
        case 9:
          return 'AllocateWithSeed';
        default:
          return 'Unknown';
      }
    } else if (
      programId === 'ComputeBudget111111111111111111111111111111' &&
      data.length > 0
    ) {
      switch (data[0]) {
        case 0:
          return 'RequestUnitsDeprecated';
        case 1:
          return 'RequestHeapFrame';
        case 2:
          return 'SetComputeUnitLimit';
        case 3:
          return 'SetComputeUnitPrice';
        default:
          return 'Unknown';
      }
    }

    return 'Unknown';
  }

  private decodeSolanaTransaction(hexString: string): {
    isValid: boolean;
    instructions?: DecodedInstruction[];
    error?: string;
  } {
    try {
      const buffer = Buffer.from(hexString, 'hex');
      const tx = Transaction.from(buffer);

      const instructions = tx.instructions.map((instruction) => {
        const programId = instruction.programId.toBase58();
        const instructionType = this.getSolanaInstructionType(instruction);

        return {
          programId,
          instructionType,
          data: instruction.data,
          accounts: instruction.keys.map((key) => ({
            pubkey: key.pubkey,
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
        };
      });

      return {
        isValid: true,
        instructions,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
