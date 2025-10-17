import { ethers } from 'ethers';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { BaseEVMValidator, EVMTransaction } from '../base.validator';

const LIDO_CONTRACTS = {
  stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  withdrawalQueue: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
};

const LIDO_REFERRAL = '0x371240E80Bf84eC2bA8b55aE2fD0B467b16Db2be';

const LIDO_ABI = [
  'function submit(address _referral) payable returns (uint256)',
  'function requestWithdrawals(uint256[] _amounts, address _owner) returns (uint256[])',
  'function claimWithdrawal(uint256 _requestId)',
  'function claimWithdrawals(uint256[] _requestIds, uint256[] _hints)',
];

export class LidoValidator extends BaseEVMValidator {
  private readonly lidoInterface: ethers.Interface;

  constructor() {
    super();
    this.lidoInterface = new ethers.Interface(LIDO_ABI);
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.STAKE,
      TransactionType.UNSTAKE,
      TransactionType.CLAIM_UNSTAKED,
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
      1,
      'Lido only supported on Ethereum mainnet',
    );
    if (chainErr) return chainErr;

    switch (transactionType) {
      case TransactionType.STAKE:
        return this.validateStake(tx);
      case TransactionType.UNSTAKE:
        return this.validateUnstake(tx, userAddress);
      case TransactionType.CLAIM_UNSTAKED:
        return this.validateClaim(tx);
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  private validateStake(tx: EVMTransaction): ValidationResult {
    if (tx.to?.toLowerCase() !== LIDO_CONTRACTS.stETH.toLowerCase()) {
      return this.blocked('Transaction not to Lido stETH contract', {
        expected: LIDO_CONTRACTS.stETH,
        actual: tx.to,
      });
    }

    const result = this.parseAndValidateCalldata(tx, this.lidoInterface);
    if ('error' in result) return result.error;

    const { parsed } = result;

    if (parsed.name !== 'submit') {
      return this.blocked('Invalid method for staking', {
        expected: 'submit',
        actual: parsed.name,
      });
    }

    const [referral] = parsed.args;
    if (referral.toLowerCase() !== LIDO_REFERRAL.toLowerCase()) {
      return this.blocked('Invalid referral address', {
        expected: LIDO_REFERRAL,
        actual: referral,
      });
    }

    return this.safe();
  }

  private validateUnstake(
    tx: EVMTransaction,
    userAddress: string,
  ): ValidationResult {
    if (tx.to?.toLowerCase() !== LIDO_CONTRACTS.withdrawalQueue.toLowerCase()) {
      return this.blocked('Transaction not to Lido Withdrawal Queue contract', {
        expected: LIDO_CONTRACTS.withdrawalQueue,
        actual: tx.to,
      });
    }

    const value = BigInt(tx.value ?? '0');
    if (value > 0n) {
      return this.blocked('Unstake should not send ETH value', {
        value: value.toString(),
      });
    }

    const result = this.parseAndValidateCalldata(tx, this.lidoInterface);
    if ('error' in result) return result.error;

    const { parsed } = result;

    if (parsed.name !== 'requestWithdrawals') {
      return this.blocked('Invalid method for unstaking', {
        expected: 'requestWithdrawals',
        actual: parsed.name,
      });
    }

    const [amounts, owner] = parsed.args;

    if (owner.toLowerCase() !== userAddress.toLowerCase()) {
      return this.blocked('Withdrawal request owner is not user address', {
        expected: userAddress,
        actual: owner,
      });
    }

    if (!Array.isArray(amounts) || amounts.length === 0) {
      return this.blocked('Withdrawal amounts array is empty');
    }

    return this.safe();
  }

  private validateClaim(tx: EVMTransaction): ValidationResult {
    if (tx.to?.toLowerCase() !== LIDO_CONTRACTS.withdrawalQueue.toLowerCase()) {
      return this.blocked('Transaction not to Lido Withdrawal Queue contract', {
        expected: LIDO_CONTRACTS.withdrawalQueue,
        actual: tx.to,
      });
    }

    const claimValue = BigInt(tx.value ?? '0');
    if (claimValue > 0n) {
      return this.blocked('Claim should not send ETH value', {
        value: claimValue.toString(),
      });
    }

    const result = this.parseAndValidateCalldata(tx, this.lidoInterface);
    if ('error' in result) return result.error;

    const { parsed } = result;

    if (parsed.name === 'claimWithdrawal') {
      return this.safe();
    } else if (parsed.name === 'claimWithdrawals') {
      const [requestIds, hints] = parsed.args;

      if (requestIds.length === 0) {
        return this.blocked('Request IDs array is empty');
      }

      if (requestIds.length !== hints.length) {
        return this.blocked('Request IDs and hints arrays length mismatch', {
          requestIdsLength: requestIds.length,
          hintsLength: hints.length,
        });
      }

      return this.safe();
    } else {
      return this.blocked('Invalid method for claiming', {
        expected: 'claimWithdrawal or claimWithdrawals',
        actual: parsed.name,
      });
    }
  }
}
