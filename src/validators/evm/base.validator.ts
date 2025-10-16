import { BaseValidator } from '../base.validator';
import { ValidationResult } from '../../types';
import { isDefined, isNonEmptyString } from '../../utils/validation';
import { ethers } from 'ethers';

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

  protected parseAndValidateCalldata(
    tx: EVMTransaction,
    iface: ethers.Interface,
  ): { parsed: ethers.TransactionDescription } | { error: ValidationResult } {
    try {
      const parsed = iface.parseTransaction({
        data: tx.data ?? '0x',
        value: tx.value,
      });

      if (!isDefined(parsed)) {
        return {
          error: this.blocked('Failed to parse transaction data'),
        };
      }

      // Check for tampering
      const tamperErr = this.ensureCalldataNotTampered(
        tx.data ?? '0x',
        iface,
        parsed,
      );

      if (tamperErr) {
        return { error: tamperErr };
      }

      return { parsed };
    } catch (error) {
      return {
        error: this.blocked('Invalid transaction data', {
          error: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  protected ensureCalldataNotTampered(
    originalCalldata: string,
    iface: ethers.Interface,
    parsedTx: ethers.TransactionDescription,
  ): ValidationResult | null {
    try {
      // Re-encode the function call with the parsed arguments
      const expectedCalldata = iface.encodeFunctionData(
        parsedTx.name,
        parsedTx.args,
      );

      // Normalize both to lowercase for comparison
      const normalizedOriginal = originalCalldata.toLowerCase();
      const normalizedExpected = expectedCalldata.toLowerCase();

      // Check if they match exactly
      if (normalizedOriginal !== normalizedExpected) {
        return this.blocked('Transaction calldata has been tampered with', {
          expectedLength: expectedCalldata.length,
          actualLength: originalCalldata.length,
          lengthDifference: originalCalldata.length - expectedCalldata.length,
        });
      }

      return null;
    } catch (error) {
      return this.blocked('Failed to validate calldata integrity', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
