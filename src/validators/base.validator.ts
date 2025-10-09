import {
  ActionArguments,
  ValidationResult,
  TransactionType,
  ValidationContext,
} from '../types';

export abstract class BaseValidator {
  protected safe(): ValidationResult {
    return { isValid: true };
  }

  protected blocked(
    reason: string,
    details?: Record<string, unknown>,
  ): ValidationResult {
    return {
      isValid: false,
      reason,
      details,
    };
  }

  abstract getSupportedTransactionTypes(): TransactionType[];

  abstract validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    args?: ActionArguments,
    context?: ValidationContext,
  ): ValidationResult;
}
