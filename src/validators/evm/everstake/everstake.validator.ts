import { ethers } from 'ethers';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { BaseEVMValidator, EVMTransaction } from '../base.validator';

export interface EverstakeNetworkConfig {
  chainId: number;
  pool: string;
  accounting: string;
}

export const EVERSTAKE_NETWORKS = {
  mainnet: {
    chainId: 1,
    pool: '0xD523794C879D9eC028960a231F866758e405bE34',
    accounting: '0x7a7f0b3c23C23a31cFcb0c44709be70d4D545c6e',
  },
  hoodi: {
    chainId: 560048,
    pool: '0x7967AcFc9EB46cA2d20076B61B05e224F2d0B8b3',
    accounting: '0x6Cf2F03804b171ef9CAFC71e302CA0e08A3FDC28',
  },
} as const satisfies Record<string, EverstakeNetworkConfig>;

/** Yield.xyz partner id that Everstake attributes stakes and unstakes to. */
const EVERSTAKE_SOURCE = 9n;

/** Pending stakers an unstake may interchange with, as built by the Everstake module. */
const EVERSTAKE_ALLOWED_INTERCHANGE_NUM = 10n;

const POOL_ABI = [
  'function stake(uint64 source) payable',
  'function unstake(uint256 value, uint16 allowedInterchangeNum, uint64 source) returns (uint256)',
];

const ACCOUNTING_ABI = ['function claimWithdrawRequest()'];

export class EverstakeValidator extends BaseEVMValidator {
  private readonly poolInterface = new ethers.Interface(POOL_ABI);
  private readonly accountingInterface = new ethers.Interface(ACCOUNTING_ABI);

  constructor(private readonly network: EverstakeNetworkConfig) {
    super();
  }

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
    _args?: ActionArguments,
    _context?: ValidationContext,
  ): ValidationResult {
    const decoded = this.decodeEVMTransaction(unsignedTransaction);
    if (!decoded.isValid || !decoded.transaction) {
      return this.blocked('Failed to decode EVM transaction', {
        error: decoded.error,
      });
    }

    const tx = decoded.transaction;

    const fromErr = this.ensureTransactionFromIsUser(tx, userAddress);
    if (fromErr) return fromErr;

    const chainErr = this.ensureChainIdEquals(
      tx,
      this.network.chainId,
      `Everstake transaction must be on chain ${this.network.chainId}`,
    );
    if (chainErr) return chainErr;

    switch (transactionType) {
      case TransactionType.STAKE:
        return this.validateStake(tx);
      case TransactionType.UNSTAKE:
        return this.validateUnstake(tx);
      case TransactionType.WITHDRAW:
        return this.validateWithdraw(tx);
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  private validateStake(tx: EVMTransaction): ValidationResult {
    const targetErr = this.ensureTarget(tx, this.network.pool, 'Pool');
    if (targetErr) return targetErr;

    if (this.getValue(tx) <= 0n) {
      return this.blocked('Stake must send ETH value', {
        value: this.getValue(tx).toString(),
      });
    }

    const result = this.parseAndValidateCalldata(tx, this.poolInterface);
    if ('error' in result) return result.error;

    const { parsed } = result;
    if (parsed.name !== 'stake') {
      return this.blocked('Invalid method for staking', {
        expected: 'stake',
        actual: parsed.name,
      });
    }

    const [source] = parsed.args;
    return this.ensureSource(source) ?? this.safe();
  }

  private validateUnstake(tx: EVMTransaction): ValidationResult {
    const targetErr = this.ensureTarget(tx, this.network.pool, 'Pool');
    if (targetErr) return targetErr;

    const valueErr = this.ensureNoValue(tx, 'Unstake');
    if (valueErr) return valueErr;

    const result = this.parseAndValidateCalldata(tx, this.poolInterface);
    if ('error' in result) return result.error;

    const { parsed } = result;
    if (parsed.name !== 'unstake') {
      return this.blocked('Invalid method for unstaking', {
        expected: 'unstake',
        actual: parsed.name,
      });
    }

    const [amount, allowedInterchangeNum, source] = parsed.args;

    if (BigInt(amount) <= 0n) {
      return this.blocked('Unstake amount must be greater than zero');
    }

    if (BigInt(allowedInterchangeNum) !== EVERSTAKE_ALLOWED_INTERCHANGE_NUM) {
      return this.blocked('Invalid allowed interchange number', {
        expected: EVERSTAKE_ALLOWED_INTERCHANGE_NUM.toString(),
        actual: BigInt(allowedInterchangeNum).toString(),
      });
    }

    return this.ensureSource(source) ?? this.safe();
  }

  private validateWithdraw(tx: EVMTransaction): ValidationResult {
    const targetErr = this.ensureTarget(
      tx,
      this.network.accounting,
      'Accounting',
    );
    if (targetErr) return targetErr;

    const valueErr = this.ensureNoValue(tx, 'Withdraw');
    if (valueErr) return valueErr;

    const result = this.parseAndValidateCalldata(tx, this.accountingInterface);
    if ('error' in result) return result.error;

    if (result.parsed.name !== 'claimWithdrawRequest') {
      return this.blocked('Invalid method for withdrawing', {
        expected: 'claimWithdrawRequest',
        actual: result.parsed.name,
      });
    }

    return this.safe();
  }

  private ensureTarget(
    tx: EVMTransaction,
    expected: string,
    contractName: string,
  ): ValidationResult | null {
    if (tx.to?.toLowerCase() !== expected.toLowerCase()) {
      return this.blocked(
        `Transaction not to Everstake ${contractName} contract`,
        { expected, actual: tx.to },
      );
    }
    return null;
  }

  private ensureNoValue(
    tx: EVMTransaction,
    action: string,
  ): ValidationResult | null {
    const value = this.getValue(tx);
    if (value > 0n) {
      return this.blocked(`${action} should not send ETH value`, {
        value: value.toString(),
      });
    }
    return null;
  }

  private ensureSource(source: bigint): ValidationResult | null {
    if (BigInt(source) !== EVERSTAKE_SOURCE) {
      return this.blocked('Invalid Everstake source', {
        expected: EVERSTAKE_SOURCE.toString(),
        actual: BigInt(source).toString(),
      });
    }
    return null;
  }

  private getValue(tx: EVMTransaction): bigint {
    return BigInt(tx.value ?? '0');
  }
}
