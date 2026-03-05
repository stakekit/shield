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

const LIFI_CONTRACTS = new Set([
  '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae', // LI.FI Diamond
  '0x89c6340b1a1f4b25d36cd8b063d49045caf3f818', // Permit2 Proxy
]);

const LIFI_DIAMOND = '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae';

const LIFI_SWAP_ABI = [
  'function swapTokensSingleV3ERC20ToERC20(bytes32 _transactionId, string _integrator, string _referrer, address _receiver, uint256 _minAmountOut, (address callTo, address approveTo, address sendingAssetId, address receivingAssetId, uint256 fromAmount, bytes callData, bool requiresDeposit) _swapData)',
  'function swapTokensSingleV3ERC20ToNative(bytes32 _transactionId, string _integrator, string _referrer, address _receiver, uint256 _minAmountOut, (address callTo, address approveTo, address sendingAssetId, address receivingAssetId, uint256 fromAmount, bytes callData, bool requiresDeposit) _swapData)',
  'function swapTokensMultipleV3ERC20ToERC20(bytes32 _transactionId, string _integrator, string _referrer, address _receiver, uint256 _minAmountOut, (address callTo, address approveTo, address sendingAssetId, address receivingAssetId, uint256 fromAmount, bytes callData, bool requiresDeposit)[] _swapData)',
  'function swapTokensMultipleV3ERC20ToNative(bytes32 _transactionId, string _integrator, string _referrer, address _receiver, uint256 _minAmountOut, (address callTo, address approveTo, address sendingAssetId, address receivingAssetId, uint256 fromAmount, bytes callData, bool requiresDeposit)[] _swapData)',
];

const PERMIT2_PROXY_ABI = [
  'function callDiamondWithPermit2(bytes _diamondCalldata, ((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) _permit, bytes _signature) payable returns (bytes)',
  'function callDiamondWithPermit2Witness(bytes _diamondCalldata, address _signer, ((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) _permit, bytes _signature) payable returns (bytes)',
  'function callDiamondWithEIP2612Signature(address tokenAddress, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s, bytes diamondCalldata) payable returns (bytes)',
];

export class RocketPoolValidator extends BaseEVMValidator {
  private readonly rocketPoolInterface: ethers.Interface;
  private readonly lifiSwapInterface: ethers.Interface;
  private readonly permit2ProxyInterface: ethers.Interface;

  constructor() {
    super();
    this.rocketPoolInterface = new ethers.Interface(ROCKETPOOL_ABI);
    this.lifiSwapInterface = new ethers.Interface(LIFI_SWAP_ABI);
    this.permit2ProxyInterface = new ethers.Interface(PERMIT2_PROXY_ABI);
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.STAKE,
      TransactionType.APPROVAL,
      TransactionType.SWAP,
    ];
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
      case TransactionType.SWAP:
        return this.validateSwap(tx, userAddress);
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

    const [spender] = result.parsed.args;
    if (!LIFI_CONTRACTS.has(spender.toLowerCase())) {
      return this.blocked('Approval spender is not a known LI.FI contract', {
        spender,
        knownContracts: Array.from(LIFI_CONTRACTS),
      });
    }

    return this.safe();
  }

  private validateSwap(
    tx: EVMTransaction,
    userAddress: string,
  ): ValidationResult {
    if (!tx.to || !LIFI_CONTRACTS.has(tx.to.toLowerCase())) {
      return this.blocked('SWAP target is not a known LI.FI contract', {
        actual: tx.to,
        knownContracts: Array.from(LIFI_CONTRACTS),
      });
    }

    const value = BigInt(tx.value ?? '0');
    if (value > 0n) {
      return this.blocked('SWAP should not send ETH value', {
        value: value.toString(),
      });
    }

    if (!tx.data || tx.data === '0x' || tx.data.length < 10) {
      return this.blocked('SWAP transaction has no calldata');
    }

    const diamondCalldata = this.extractDiamondCalldata(tx);
    if (!diamondCalldata) {
      return this.blocked(
        'Failed to extract Diamond calldata from Permit2 Proxy',
      );
    }

    return this.validateLifiSwapReceiver(diamondCalldata, userAddress);
  }

  private extractDiamondCalldata(tx: EVMTransaction): string | null {
    if (tx.to!.toLowerCase() === LIFI_DIAMOND) {
      return tx.data!;
    }

    // Permit2 Proxy: parse outer function to extract inner diamondCalldata
    try {
      const parsed = this.permit2ProxyInterface.parseTransaction({
        data: tx.data!,
      });
      if (!parsed) return null;

      // callDiamondWithEIP2612Signature has diamondCalldata at param index 6
      // callDiamondWithPermit2 and callDiamondWithPermit2Witness have it at param index 0
      if (parsed.name === 'callDiamondWithEIP2612Signature') {
        return parsed.args[6];
      }
      return parsed.args[0];
    } catch {
      return null;
    }
  }

  private validateLifiSwapReceiver(
    calldata: string,
    userAddress: string,
  ): ValidationResult {
    let parsed: ethers.TransactionDescription | null;
    try {
      parsed = this.lifiSwapInterface.parseTransaction({ data: calldata });
    } catch {
      return this.blocked('Unknown LI.FI Diamond function selector', {
        selector: calldata.slice(0, 10),
      });
    }

    if (!parsed) {
      return this.blocked('Failed to parse LI.FI swap calldata');
    }

    const receiver: string = parsed.args[3];
    if (receiver.toLowerCase() !== userAddress.toLowerCase()) {
      return this.blocked('SWAP receiver does not match user address', {
        receiver,
        userAddress,
      });
    }

    return this.safe();
  }
}
