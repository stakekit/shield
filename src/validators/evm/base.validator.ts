import { BaseValidator } from '../base.validator';
import { ValidationResult } from '../../types';
import { isDefined, isNonEmptyString } from '../../utils/validation';

export interface EVMTransaction {
  to: string | null;
  from?: string;
  value?: string | number;
  data?: string;
  nonce?: string | number;
  gasLimit?: string | number;
  gasPrice?: string | number;
  maxFeePerGas?: string | number;
  maxPriorityFeePerGas?: string | number;
  chainId?: string | number;
  type?: string | number;
}

export abstract class BaseEVMValidator extends BaseValidator {
  protected decodeEVMTransaction(transactionString: string): {
    isValid: boolean;
    transaction?: EVMTransaction;
    error?: string;
  } {
    try {
      const transaction = JSON.parse(transactionString) as EVMTransaction;

      if (!isDefined(transaction.chainId)) {
        return {
          isValid: false,
          error: 'Missing chain ID in transaction',
        };
      }

      const chainId =
        typeof transaction.chainId === 'string'
          ? parseInt(transaction.chainId, 10)
          : transaction.chainId;

      if (Number.isNaN(chainId)) {
        return {
          isValid: false,
          error: `Invalid chain ID format: ${transaction.chainId}`,
        };
      }

      return {
        isValid: true,
        transaction,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected ensureTransactionFromIsUser(
    transaction: EVMTransaction,
    userAddress: string,
  ): ValidationResult | null {
    if (!isNonEmptyString(transaction.from)) {
      return this.blocked('Transaction not from user address', {
        expected: userAddress,
        actual: 'unknown',
      });
    }

    if (transaction.from.toLowerCase() !== userAddress.toLowerCase()) {
      return this.blocked('Transaction not from user address', {
        expected: userAddress,
        actual: transaction.from,
      });
    }
    return null;
  }

  protected getNumericChainId(transaction: EVMTransaction): number | null {
    if (!isDefined(transaction.chainId)) {
      return null;
    }
    const chainId =
      typeof transaction.chainId === 'string'
        ? parseInt(transaction.chainId, 10)
        : transaction.chainId;
    return Number.isNaN(chainId) ? null : chainId;
  }

  protected ensureChainIdEquals(
    transaction: EVMTransaction,
    requiredChainId: number,
    messageWhenMismatch: string,
  ): ValidationResult | null {
    const chainId = this.getNumericChainId(transaction);
    if (chainId === null || chainId !== requiredChainId) {
      return this.blocked(messageWhenMismatch, {
        chainId: transaction.chainId,
      });
    }
    return null;
  }
}
