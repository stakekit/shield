import { TronWeb } from 'tronweb';
import {
  ActionArguments,
  TransactionType,
  TronResourceType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import {
  isDefined,
  isNonEmptyString,
  isNullOrUndefined,
} from '../../../utils/validation';
import { BaseValidator } from '../../base.validator';

export class TronValidator extends BaseValidator {
  private readonly MAXIMUM_VALIDATOR_COUNT = 30;

  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.VOTE,
      TransactionType.FREEZE_BANDWIDTH,
      TransactionType.FREEZE_ENERGY,
      TransactionType.UNFREEZE_BANDWIDTH,
      TransactionType.UNFREEZE_ENERGY,
      TransactionType.UNDELEGATE_BANDWIDTH,
      TransactionType.UNDELEGATE_ENERGY,
      TransactionType.UNFREEZE_LEGACY_BANDWIDTH,
      TransactionType.UNFREEZE_LEGACY_ENERGY,
      TransactionType.WITHDRAW,
      TransactionType.CLAIM_REWARDS,
    ];
  }

  validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    args?: ActionArguments,

    _context?: ValidationContext,
  ): ValidationResult {
    return this._validate(
      unsignedTransaction,
      transactionType,
      userAddress,
      args,
    );
  }

  private _validate(
    transaction: string,
    transactionType: TransactionType,
    userAddress: string,
    args?: ActionArguments,
  ): ValidationResult {
    switch (transactionType) {
      case TransactionType.VOTE:
        return this.validateVote(transaction, userAddress, args);
      case TransactionType.FREEZE_BANDWIDTH:
        return this.validateFreeze(
          transaction,
          userAddress,
          TronResourceType.BANDWIDTH,
        );
      case TransactionType.FREEZE_ENERGY:
        return this.validateFreeze(
          transaction,
          userAddress,
          TronResourceType.ENERGY,
        );
      case TransactionType.UNFREEZE_BANDWIDTH:
        return this.validateUnfreeze(
          transaction,
          userAddress,
          TronResourceType.BANDWIDTH,
        );
      case TransactionType.UNFREEZE_ENERGY:
        return this.validateUnfreeze(
          transaction,
          userAddress,
          TronResourceType.ENERGY,
        );

      case TransactionType.UNDELEGATE_BANDWIDTH:
        return this.validateUndelegate(
          transaction,
          userAddress,
          TronResourceType.BANDWIDTH,
        );

      case TransactionType.UNDELEGATE_ENERGY:
        return this.validateUndelegate(
          transaction,
          userAddress,
          TronResourceType.ENERGY,
        );

      case TransactionType.UNFREEZE_LEGACY_BANDWIDTH:
        return this.validateUnfreezeLegacy(
          transaction,
          userAddress,
          TronResourceType.BANDWIDTH,
        );

      case TransactionType.UNFREEZE_LEGACY_ENERGY:
        return this.validateUnfreezeLegacy(
          transaction,
          userAddress,
          TronResourceType.ENERGY,
        );

      case TransactionType.WITHDRAW:
        return this.validateWithdrawString(transaction, userAddress);

      case TransactionType.CLAIM_REWARDS:
        return this.validateClaimRewardsString(transaction, userAddress);

      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  private decodeTronTransaction<T extends TronTransaction>(
    transaction: string,
  ): {
    isValid: boolean;
    transaction?: T;
    error?: string;
  } {
    try {
      const tx = JSON.parse(transaction) as T;
      return { isValid: true, transaction: tx };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private validateVote(
    transaction: string,
    userAddress: string,
    args?: ActionArguments,
  ): ValidationResult {
    const decoded = this.decodeTronTransaction<VoteTransaction>(transaction);
    if (!decoded.isValid || isNullOrUndefined(decoded.transaction)) {
      return this.blocked('Failed to decode Tron transaction', {
        error: decoded.error,
      });
    }

    const tx = decoded.transaction as VoteTransaction;

    if (
      isNullOrUndefined(tx.raw_data) ||
      isNullOrUndefined(tx.raw_data.contract) ||
      tx.raw_data.contract.length === 0
    ) {
      return this.blocked(
        'Invalid transaction structure: missing contract data',
      );
    }

    const contract = tx.raw_data.contract[0];

    if (isNullOrUndefined(contract)) {
      return this.blocked('Invalid transaction: missing contract');
    }

    if (contract.type !== 'VoteWitnessContract') {
      return this.blocked('Invalid contract type for vote transaction', {
        expected: 'VoteWitnessContract',
        actual: contract.type,
      });
    }

    const contractValue = contract.parameter?.value;
    if (isNullOrUndefined(contractValue)) {
      return this.blocked(
        'Invalid transaction: missing contract parameter value',
      );
    }

    const ownerErr = this.ensureOwnerMatchesUser(
      contractValue.owner_address,
      userAddress,
    );
    if (ownerErr) return ownerErr;

    if (
      isNullOrUndefined(contractValue.votes) ||
      !Array.isArray(contractValue.votes)
    ) {
      return this.blocked(
        'Invalid transaction: missing or invalid votes array',
      );
    }

    if (contractValue.votes.length === 0) {
      return this.blocked('Invalid transaction: votes array is empty');
    }

    if (contractValue.votes.length > this.MAXIMUM_VALIDATOR_COUNT) {
      return this.blocked('Too many validators', {
        max: this.MAXIMUM_VALIDATOR_COUNT,
        actual: contractValue.votes.length,
      });
    }

    let totalVotes = 0;
    const txValidatorAddresses = new Set<string>();

    for (const vote of contractValue.votes) {
      if (isNullOrUndefined(vote)) {
        return this.blocked('Invalid vote structure', { vote });
      }

      if (
        typeof vote.vote_address !== 'string' ||
        typeof vote.vote_count !== 'number'
      ) {
        return this.blocked('Invalid vote structure', { vote });
      }

      if (!TronWeb.isAddress(vote.vote_address)) {
        return this.blocked('Invalid validator address in votes', {
          address: vote.vote_address,
        });
      }

      const flooredVoteCount = Math.floor(vote.vote_count);

      if (flooredVoteCount <= 0) {
        return this.blocked(
          'Invalid vote count: must be positive after rounding',
          {
            validator: vote.vote_address,
            originalVoteCount: vote.vote_count,
            flooredVoteCount: flooredVoteCount,
          },
        );
      }

      totalVotes += vote.vote_count;
      txValidatorAddresses.add(this.normalizeAddress(vote.vote_address));
    }

    if (totalVotes <= 0) {
      return this.blocked('Total vote count must be positive', { totalVotes });
    }

    if (args) {
      if (isNonEmptyString(args.validatorAddress)) {
        const normalizedArgsValidator = this.normalizeAddress(
          args.validatorAddress,
        );
        if (!txValidatorAddresses.has(normalizedArgsValidator)) {
          return this.blocked('Validator address mismatch', {
            expected: args.validatorAddress,
            actual: Array.from(txValidatorAddresses),
          });
        }
      }

      if (args.validatorAddresses && args.validatorAddresses.length > 0) {
        const normalizedArgsValidators = args.validatorAddresses.map((addr) =>
          this.normalizeAddress(addr),
        );

        if (txValidatorAddresses.size !== normalizedArgsValidators.length) {
          return this.blocked('Validator addresses count mismatch', {
            expectedCount: normalizedArgsValidators.length,
            actualCount: txValidatorAddresses.size,
          });
        }

        for (const validator of normalizedArgsValidators) {
          if (!txValidatorAddresses.has(validator)) {
            return this.blocked('Validator addresses mismatch', {
              expected: args.validatorAddresses,
              actual: Array.from(txValidatorAddresses),
            });
          }
        }
      }
    }

    return this.safe();
  }

  private validateFreeze(
    transaction: string,
    userAddress: string,
    expectedResource: TronResourceType,
  ): ValidationResult {
    const decoded =
      this.decodeTronTransaction<FreezeBalanceTransaction>(transaction);
    if (!decoded.isValid || isNullOrUndefined(decoded.transaction)) {
      return this.blocked('Failed to decode Tron transaction', {
        error: decoded.error,
      });
    }

    const tx = decoded.transaction as FreezeBalanceTransaction;

    if (
      isNullOrUndefined(tx.raw_data) ||
      isNullOrUndefined(tx.raw_data.contract) ||
      tx.raw_data.contract.length === 0
    ) {
      return this.blocked(
        'Invalid transaction structure: missing contract data',
      );
    }

    const contract = tx.raw_data.contract[0];

    if (isNullOrUndefined(contract)) {
      return this.blocked('Invalid transaction: missing contract');
    }

    if (contract.type !== 'FreezeBalanceV2Contract') {
      return this.blocked('Invalid contract type for freeze transaction', {
        expected: 'FreezeBalanceV2Contract',
        actual: contract.type,
      });
    }

    const contractValue = contract.parameter?.value;
    if (isNullOrUndefined(contractValue)) {
      return this.blocked(
        'Invalid transaction: missing contract parameter value',
      );
    }

    const ownerErr = this.ensureOwnerMatchesUser(
      contractValue.owner_address,
      userAddress,
    );
    if (ownerErr) return ownerErr;

    if (!isDefined(contractValue.frozen_balance)) {
      return this.blocked('Invalid transaction: missing frozen balance');
    }

    const actualResource = contractValue.resource || TronResourceType.BANDWIDTH;

    if (
      actualResource !== TronResourceType.BANDWIDTH &&
      actualResource !== TronResourceType.ENERGY
    ) {
      return this.blocked('Invalid resource type', {
        validTypes: [TronResourceType.BANDWIDTH, TronResourceType.ENERGY],
        actual: actualResource,
      });
    }

    if (
      !contractValue.resource &&
      expectedResource === TronResourceType.ENERGY
    ) {
      return this.blocked(
        'Transaction without resource field can only be BANDWIDTH',
        {
          expected: expectedResource,
          actual: 'BANDWIDTH (default)',
        },
      );
    }

    if (actualResource !== expectedResource) {
      return this.blocked('Resource type mismatch', {
        expected: expectedResource,
        actual: actualResource,
      });
    }

    return this.safe();
  }

  private validateUnfreeze(
    transaction: string,
    userAddress: string,
    expectedResource: TronResourceType,
  ): ValidationResult {
    const decoded =
      this.decodeTronTransaction<UnfreezeBalanceTransaction>(transaction);

    if (!decoded.isValid || isNullOrUndefined(decoded.transaction)) {
      return this.blocked('Failed to decode Tron transaction', {
        error: decoded.error,
      });
    }

    const tx = decoded.transaction as UnfreezeBalanceTransaction;

    if (
      isNullOrUndefined(tx.raw_data) ||
      isNullOrUndefined(tx.raw_data.contract) ||
      tx.raw_data.contract.length === 0
    ) {
      return this.blocked(
        'Invalid transaction structure: missing contract data',
      );
    }

    const contract = tx.raw_data.contract[0];

    if (isNullOrUndefined(contract)) {
      return this.blocked('Invalid transaction: missing contract');
    }

    if (contract.type !== 'UnfreezeBalanceV2Contract') {
      return this.blocked('Invalid contract type for unfreeze transaction', {
        expected: 'UnfreezeBalanceV2Contract',
        actual: contract.type,
      });
    }

    const contractValue = contract.parameter?.value;
    if (isNullOrUndefined(contractValue)) {
      return this.blocked(
        'Invalid transaction: missing contract parameter value',
      );
    }

    const ownerErr = this.ensureOwnerMatchesUser(
      contractValue.owner_address,
      userAddress,
    );
    if (ownerErr) return ownerErr;

    if (!isDefined(contractValue.unfreeze_balance)) {
      return this.blocked('Invalid transaction: missing unfreeze balance');
    }

    const actualResource = contractValue.resource || TronResourceType.BANDWIDTH;

    if (
      actualResource !== TronResourceType.BANDWIDTH &&
      actualResource !== TronResourceType.ENERGY
    ) {
      return this.blocked('Invalid resource type', {
        validTypes: [TronResourceType.BANDWIDTH, TronResourceType.ENERGY],
        actual: actualResource,
      });
    }

    if (
      !contractValue.resource &&
      expectedResource === TronResourceType.ENERGY
    ) {
      return this.blocked(
        'Transaction without resource field can only be BANDWIDTH',
        {
          expected: expectedResource,
          actual: 'BANDWIDTH (default)',
        },
      );
    }

    if (actualResource !== expectedResource) {
      return this.blocked('Resource type mismatch', {
        expected: expectedResource,
        actual: actualResource,
      });
    }

    return this.safe();
  }

  private normalizeAddress(address: string): string {
    return TronWeb.address.fromHex(address);
  }

  private ensureOwnerMatchesUser(
    ownerAddress: string | undefined | null,
    userAddress: string,
  ): ValidationResult | null {
    if (!isNonEmptyString(ownerAddress)) {
      return this.blocked('Invalid transaction: missing owner address');
    }

    if (!TronWeb.isAddress(ownerAddress)) {
      return this.blocked('Invalid owner address format', { ownerAddress });
    }
    const txOwnerAddress = this.normalizeAddress(ownerAddress);
    if (!TronWeb.isAddress(userAddress)) {
      return this.blocked('Invalid user address format', { userAddress });
    }
    const normalizedUserAddress = this.normalizeAddress(userAddress);
    if (txOwnerAddress !== normalizedUserAddress) {
      return this.blocked(
        'Transaction owner address does not match user address',
        {
          expected: normalizedUserAddress,
          actual: txOwnerAddress,
        },
      );
    }
    return null;
  }

  private validateWithdrawString(
    transaction: string,
    userAddress: string,
  ): ValidationResult {
    const decoded = this.decodeTronTransaction<TronTransaction>(transaction);
    if (!decoded.isValid || isNullOrUndefined(decoded.transaction)) {
      return this.blocked('Failed to decode Tron transaction', {
        error: decoded.error,
      });
    }
    return this.validateWithdraw(decoded.transaction, userAddress);
  }

  private validateClaimRewardsString(
    transaction: string,
    userAddress: string,
  ): ValidationResult {
    const decoded = this.decodeTronTransaction<TronTransaction>(transaction);
    if (!decoded.isValid || isNullOrUndefined(decoded.transaction)) {
      return this.blocked('Failed to decode Tron transaction', {
        error: decoded.error,
      });
    }
    return this.validateClaimRewards(decoded.transaction, userAddress);
  }

  private validateWithdraw(
    transaction: TronTransaction,
    userAddress: string,
  ): ValidationResult {
    const contractType = transaction.raw_data?.contract?.[0]?.type;
    if (contractType !== 'WithdrawExpireUnfreezeContract') {
      return this.blocked('Invalid contract type for withdraw', {
        expected: 'WithdrawExpireUnfreezeContract',
        actual: contractType,
      });
    }

    const contractValue = transaction.raw_data?.contract?.[0]?.parameter?.value;
    if (isNullOrUndefined(contractValue)) {
      return this.blocked('Invalid transaction: missing contract value');
    }

    const ownerAddress = contractValue.owner_address;
    const ownerValidation = this.ensureOwnerMatchesUser(
      ownerAddress,
      userAddress,
    );
    if (ownerValidation) {
      return ownerValidation;
    }

    return { isValid: true };
  }

  private validateClaimRewards(
    transaction: TronTransaction,
    userAddress: string,
  ): ValidationResult {
    const contractType = transaction.raw_data?.contract?.[0]?.type;
    if (contractType !== 'WithdrawBalanceContract') {
      return this.blocked('Invalid contract type for claim rewards', {
        expected: 'WithdrawBalanceContract',
        actual: contractType,
      });
    }

    const contractValue = transaction.raw_data?.contract?.[0]?.parameter?.value;
    if (isNullOrUndefined(contractValue)) {
      return this.blocked('Invalid transaction: missing contract value');
    }

    const ownerAddress = contractValue.owner_address;
    const ownerValidation = this.ensureOwnerMatchesUser(
      ownerAddress,
      userAddress,
    );
    if (ownerValidation) {
      return ownerValidation;
    }

    return { isValid: true };
  }

  private validateUndelegate(
    transaction: string,
    userAddress: string,
    expectedResource: TronResourceType,
  ): ValidationResult {
    const decoded =
      this.decodeTronTransaction<UndelegateResourceTransaction>(transaction);

    if (!decoded.isValid || isNullOrUndefined(decoded.transaction)) {
      return this.blocked('Failed to decode Tron transaction', {
        error: decoded.error,
      });
    }

    const tx = decoded.transaction as UndelegateResourceTransaction;

    if (
      isNullOrUndefined(tx.raw_data) ||
      isNullOrUndefined(tx.raw_data.contract) ||
      tx.raw_data.contract.length === 0
    ) {
      return this.blocked(
        'Invalid transaction structure: missing contract data',
      );
    }

    const contract = tx.raw_data.contract[0];

    if (isNullOrUndefined(contract)) {
      return this.blocked('Invalid transaction: missing contract');
    }

    if (contract.type !== 'UnDelegateResourceContract') {
      return this.blocked('Invalid contract type for undelegate transaction', {
        expected: 'UnDelegateResourceContract',
        actual: contract.type,
      });
    }

    const contractValue = contract.parameter?.value;
    if (isNullOrUndefined(contractValue)) {
      return this.blocked(
        'Invalid transaction: missing contract parameter value',
      );
    }

    const ownerErr = this.ensureOwnerMatchesUser(
      contractValue.owner_address,
      userAddress,
    );
    if (ownerErr) return ownerErr;

    if (!isDefined(contractValue.balance)) {
      return this.blocked('Invalid transaction: missing balance');
    }

    const actualResource = contractValue.resource || TronResourceType.BANDWIDTH;

    if (
      actualResource !== TronResourceType.BANDWIDTH &&
      actualResource !== TronResourceType.ENERGY
    ) {
      return this.blocked('Invalid resource type', {
        validTypes: [TronResourceType.BANDWIDTH, TronResourceType.ENERGY],
        actual: actualResource,
      });
    }

    if (actualResource !== expectedResource) {
      return this.blocked('Resource type mismatch', {
        expected: expectedResource,
        actual: actualResource,
      });
    }

    return this.safe();
  }

  private validateUnfreezeLegacy(
    transaction: string,
    userAddress: string,
    expectedResource: TronResourceType,
  ): ValidationResult {
    const decoded =
      this.decodeTronTransaction<UnfreezeBalanceV1Transaction>(transaction);

    if (!decoded.isValid || isNullOrUndefined(decoded.transaction)) {
      return this.blocked('Failed to decode Tron transaction', {
        error: decoded.error,
      });
    }

    const tx = decoded.transaction as UnfreezeBalanceV1Transaction;

    if (
      isNullOrUndefined(tx.raw_data) ||
      isNullOrUndefined(tx.raw_data.contract) ||
      tx.raw_data.contract.length === 0
    ) {
      return this.blocked(
        'Invalid transaction structure: missing contract data',
      );
    }

    const contract = tx.raw_data.contract[0];

    if (isNullOrUndefined(contract)) {
      return this.blocked('Invalid transaction: missing contract');
    }

    if (contract.type !== 'UnfreezeBalanceContract') {
      return this.blocked(
        'Invalid contract type for legacy unfreeze transaction',
        {
          expected: 'UnfreezeBalanceContract',
          actual: contract.type,
        },
      );
    }

    const contractValue = contract.parameter?.value;
    if (isNullOrUndefined(contractValue)) {
      return this.blocked(
        'Invalid transaction: missing contract parameter value',
      );
    }

    const ownerErr = this.ensureOwnerMatchesUser(
      contractValue.owner_address,
      userAddress,
    );
    if (ownerErr) return ownerErr;

    const actualResource = contractValue.resource || TronResourceType.BANDWIDTH;

    if (
      !contractValue.resource &&
      expectedResource !== TronResourceType.BANDWIDTH
    ) {
      return this.blocked(
        'Legacy unfreeze transaction without resource field can only be BANDWIDTH',
        {
          expected: expectedResource,
          actual: 'BANDWIDTH (default)',
        },
      );
    }

    if (actualResource !== expectedResource) {
      return this.blocked(
        'Resource type mismatch in legacy unfreeze transaction',
        {
          expected: expectedResource,
          actual: actualResource,
        },
      );
    }

    return this.safe();
  }
}

type VoteTransaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['vote']>
>;
type FreezeBalanceTransaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['freezeBalanceV2']>
>;
type UnfreezeBalanceTransaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['unfreezeBalanceV2']>
>;
type WithdrawTransaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['withdrawExpireUnfreeze']>
>;
type ClaimRewardsTransaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['withdrawBlockRewards']>
>;
type UndelegateResourceTransaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['undelegateResource']>
>;
type UnfreezeBalanceV1Transaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['unfreezeBalance']>
>;

type TronTransaction =
  | VoteTransaction
  | FreezeBalanceTransaction
  | UnfreezeBalanceTransaction
  | UndelegateResourceTransaction
  | UnfreezeBalanceV1Transaction
  | WithdrawTransaction
  | ClaimRewardsTransaction;
