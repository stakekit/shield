import { ethers } from 'ethers';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { BaseEVMValidator, EVMTransaction } from '../base.validator';

const ROCKETPOOL_CONTRACTS = {
  rETH: '0xae78736Cd615f374D3085123A210448E74Fc6393',
  rocketSwapRouter: '0x16D5A408e807db8eF7c578279BEeEe6b228f1c1C',
};

const ROCKETPOOL_ABI = [
  'function swapTo(uint256 _uniswapPortion, uint256 _balancerPortion, uint256 _minTokensOut, uint256 _idealTokensOut) payable',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export class RocketPoolValidator extends BaseEVMValidator {
  private readonly rocketPoolInterface: ethers.Interface;

  constructor() {
    super();
    this.rocketPoolInterface = new ethers.Interface(ROCKETPOOL_ABI);
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [TransactionType.STAKE, TransactionType.APPROVAL];
  }

  validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    _args?: ActionArguments,
    _context?: ValidationContext,
  ): ValidationResult {
    // 1. Decode JSON → EVMTransaction
    const decoded = this.decodeEVMTransaction(unsignedTransaction);
    if (!decoded.isValid || !decoded.transaction) {
      return this.blocked('Failed to decode EVM transaction', {
        error: decoded.error,
      });
    }
    const tx = decoded.transaction;

    // 2. Verify from == userAddress
    const fromErr = this.ensureTransactionFromIsUser(tx, userAddress);
    if (fromErr) return fromErr;

    // 3. Verify chainId == 1
    const chainErr = this.ensureChainIdEquals(
      tx,
      1,
      'RocketPool only supported on Ethereum mainnet',
    );
    if (chainErr) return chainErr;

    // 4. Route to specific validation
    switch (transactionType) {
      case TransactionType.STAKE:
        return this.validateStake(tx);
      case TransactionType.APPROVAL:
        return this.validateApproval(tx);
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  private validateStake(tx: EVMTransaction): ValidationResult {
    // Verify target is RocketSwapRouter
    if (
      tx.to?.toLowerCase() !==
      ROCKETPOOL_CONTRACTS.rocketSwapRouter.toLowerCase()
    ) {
      return this.blocked('Transaction not to RocketPool SwapRouter contract', {
        expected: ROCKETPOOL_CONTRACTS.rocketSwapRouter,
        actual: tx.to,
      });
    }

    // Verify ETH value > 0 (swapTo is payable — must send ETH to receive rETH)
    const value = BigInt(tx.value ?? '0');
    if (value <= 0n) {
      return this.blocked('Stake must send ETH value', {
        value: value.toString(),
      });
    }

    // Parse calldata and verify it matches swapTo(...)
    const result = this.parseAndValidateCalldata(tx, this.rocketPoolInterface);
    if ('error' in result) return result.error;

    if (result.parsed.name !== 'swapTo') {
      return this.blocked('Invalid method for staking', {
        expected: 'swapTo',
        actual: result.parsed.name,
      });
    }

    const [, , minTokensOut, idealTokensOut] = result.parsed.args;

    if (BigInt(minTokensOut) <= 0n) {
      return this.blocked('Minimum tokens out must be greater than zero');
    }

    if (BigInt(idealTokensOut) <= 0n) {
      return this.blocked('Ideal tokens out must be greater than zero');
    }

    if (BigInt(minTokensOut) > BigInt(idealTokensOut)) {
      return this.blocked('Minimum tokens out exceeds ideal tokens out', {
        minTokensOut: BigInt(minTokensOut).toString(),
        idealTokensOut: BigInt(idealTokensOut).toString(),
      });
    }

    return this.safe();
  }

  private validateApproval(tx: EVMTransaction): ValidationResult {
    // Verify target is rETH contract
    if (tx.to?.toLowerCase() !== ROCKETPOOL_CONTRACTS.rETH.toLowerCase()) {
      return this.blocked('Transaction not to RocketPool rETH contract', {
        expected: ROCKETPOOL_CONTRACTS.rETH,
        actual: tx.to,
      });
    }

    // Verify no ETH value
    const value = BigInt(tx.value ?? '0');
    if (value > 0n) {
      return this.blocked('Approval should not send ETH value', {
        value: value.toString(),
      });
    }

    // Parse calldata and verify it matches approve(...)
    const result = this.parseAndValidateCalldata(tx, this.rocketPoolInterface);
    if ('error' in result) return result.error;

    if (result.parsed.name !== 'approve') {
      return this.blocked('Invalid method for approval', {
        expected: 'approve',
        actual: result.parsed.name,
      });
    }

    // Verify amount > 0
    const [, amount] = result.parsed.args;
    if (BigInt(amount) <= 0n) {
      return this.blocked('Approval amount must be greater than zero');
    }

    // Note: spender (result.parsed.args[0]) is NOT validated — it's dynamic
    // from LI.FI and changes per quote. The spender validation is intentionally
    // omitted because the exit path routes through LI.FI aggregator.

    return this.safe();
  }
}
