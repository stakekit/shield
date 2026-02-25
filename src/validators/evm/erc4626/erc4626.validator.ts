import { ethers } from 'ethers';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { BaseEVMValidator, EVMTransaction } from '../base.validator';
import { VaultInfo, VaultConfiguration } from './types';
import { WETH_ADDRESSES } from './constants';


/**
 * Standard ERC4626 ABI - only the functions we need to validate
 */
const ERC4626_ABI = [
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function mint(uint256 shares, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
];

/**
 * ERC20 ABI - for approval validation
 */
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
];

/**
 * WETH ABI - for wrap/unwrap validation
 */
const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint256 wad)',
];

/**
 * Generic ERC4626 Validator
 *
 *
 * Transaction Types Validated:
 * - APPROVAL: ERC20 token approval before deposit
 * - WRAP: Convert native ETH to WETH (optional, for WETH vaults)
 * - SUPPLY: Deposit assets into vault (deposit/mint)
 * - WITHDRAW: Withdraw assets from vault (withdraw/redeem)
 * - UNWRAP: Convert WETH to native ETH (optional, for WETH vaults)
 */
export class ERC4626Validator extends BaseEVMValidator {
  private static readonly erc4626Interface = new ethers.Interface(ERC4626_ABI);
  private static readonly erc20Interface = new ethers.Interface(ERC20_ABI);
  private static readonly wethInterface = new ethers.Interface(WETH_ABI);
  private vaultInfoMap: Map<string, VaultInfo>; // "chainId:address" -> VaultInfo

  constructor(vaultConfig: VaultConfiguration) {
    super();
    this.vaultInfoMap = new Map();
    this.loadConfiguration(vaultConfig);
  }

  /**
   * Load vault configuration
   *
   */
  private loadConfiguration(config: VaultConfiguration): void {
    for (const vault of config.vaults) {
      const chainId = vault.chainId;
      const address = vault.address.toLowerCase();
      const normalizedVault = {
        ...vault,
        address,
        inputTokenAddress: vault.inputTokenAddress.toLowerCase(),
        vaultTokenAddress: vault.vaultTokenAddress.toLowerCase(),
      };
      this.vaultInfoMap.set(`${chainId}:${address}`, normalizedVault);
    }
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.APPROVAL,
      TransactionType.WRAP,
      TransactionType.SUPPLY,
      TransactionType.WITHDRAW,
      TransactionType.UNWRAP,
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

    // Validate transaction is from user
    const fromErr = this.ensureTransactionFromIsUser(tx, userAddress);
    if (fromErr) return fromErr;

    // Get and validate chain ID from transaction
    const chainId = this.getNumericChainId(tx);
    if (!chainId) {
      return this.blocked('Chain ID not found in transaction');
    }

    // Ensure destination address exists
    if (!tx.to) {
      return this.blocked('Transaction has no destination address');
    }

    // Route to appropriate validation based on transaction type
    switch (transactionType) {
      case TransactionType.APPROVAL:
        return this.validateApproval(tx, chainId);
      case TransactionType.WRAP:
        return this.validateWrap(tx, chainId);
      case TransactionType.SUPPLY:
        return this.validateSupply(tx, userAddress, chainId);
      case TransactionType.WITHDRAW:
        return this.validateWithdraw(tx, userAddress, chainId);
      case TransactionType.UNWRAP:
        return this.validateUnwrap(tx, chainId);
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  /**
   * Validate APPROVAL transaction
   */
  private validateApproval(
    tx: EVMTransaction,
    chainId: number,
  ): ValidationResult {
    // APPROVAL should not send ETH
    const value = BigInt(tx.value ?? '0');
    if (value > 0n) {
      return this.blocked('Approval transaction should not send ETH', {
        value: value.toString(),
      });
    }

    // Parse the approval calldata
    const result = this.parseAndValidateCalldata(
      tx,
      ERC4626Validator.erc20Interface,
    );
    if ('error' in result) return result.error;

    const { parsed } = result;

    // Check function is approve
    if (parsed.name !== 'approve') {
      return this.blocked('Invalid method for approval', {
        expected: 'approve',
        actual: parsed.name,
      });
    }

    // Get spender (should be vault address)
    const [spender, amount] = parsed.args;

    // Validate spender is a whitelisted vault
    const vaultInfo = this.vaultInfoMap.get(
      `${chainId}:${spender.toLowerCase()}`,
    );
    if (!vaultInfo) {
      return this.blocked('Approval spender is not a whitelisted vault', {
        spender,
        chainId,
      });
    }
    if (tx.to?.toLowerCase() !== vaultInfo.inputTokenAddress) {
      return this.blocked('Approval token does not match vault input token', {
        expected: vaultInfo.inputTokenAddress,
        actual: tx.to,
      });
    }

    // Validate amount is not zero
    const amountBigInt = BigInt(amount);
    if (amountBigInt === 0n) {
      return this.blocked('Approval amount is zero');
    }

    return this.safe();
  }

  /**
   * Validate WRAP transaction (ETH → WETH)
   */
  private validateWrap(tx: EVMTransaction, chainId: number): ValidationResult {
    // Get WETH address for this chain
    const wethAddress = this.getWethAddress(chainId);
    if (!wethAddress) {
      return this.blocked('WETH address not configured for chain', { chainId });
    }

    const hasWethVault = Array.from(this.vaultInfoMap.values()).some(
      (v) => v.chainId === chainId && v.isWethVault === true,
    );
    if (!hasWethVault) {
      return this.blocked('No WETH vaults registered for this yield', {
        chainId,
      });
    }

    // Validate transaction is to WETH contract
    if (tx.to?.toLowerCase() !== wethAddress.toLowerCase()) {
      return this.blocked('WRAP transaction not to WETH contract', {
        expected: wethAddress,
        actual: tx.to,
      });
    }

    // WRAP must send ETH value
    const value = BigInt(tx.value ?? '0');
    if (value === 0n) {
      return this.blocked('WRAP transaction must send ETH value');
    }

    // Parse the wrap calldata
    const result = this.parseAndValidateCalldata(
      tx,
      ERC4626Validator.wethInterface,
    );
    if ('error' in result) return result.error;

    const { parsed } = result;

    // Check function is deposit
    if (parsed.name !== 'deposit') {
      return this.blocked('Invalid method for wrapping', {
        expected: 'deposit',
        actual: parsed.name,
      });
    }

    return this.safe();
  }

  /**
   * Validate SUPPLY transaction (deposit/mint)
   */
  private validateSupply(
    tx: EVMTransaction,
    userAddress: string,
    chainId: number,
  ): ValidationResult {
    const resolved = this.resolveVault(tx, chainId);
    if ('error' in resolved) return resolved.error;
    const { vaultInfo } = resolved;

    // Check if vault deposits are paused
    if (vaultInfo.canEnter === false) {
      return this.blocked('Vault deposits are currently paused', {
        vaultAddress: tx.to,
        chainId,
      });
    }

    // Validate no value sent
    const value = BigInt(tx.value ?? '0');
    if (value > 0n) {
      return this.blocked('Supply transaction should not send ETH', {
        value: value.toString(),
      });
    }

    // Parse the deposit calldata
    const result = this.parseAndValidateCalldata(
      tx,
      ERC4626Validator.erc4626Interface,
    );
    if ('error' in result) return result.error;

    const { parsed } = result;

    // Check function is deposit or mint
    if (parsed.name !== 'deposit' && parsed.name !== 'mint') {
      return this.blocked('Invalid method for supply', {
        expected: 'deposit or mint',
        actual: parsed.name,
      });
    }

    // Both deposit and mint have receiver as second parameter
    const [amount, receiver] = parsed.args;
    const amountBigInt = BigInt(amount);
    if (amountBigInt === 0n) {
      return this.blocked('Supply amount is zero');
    }

    // Validate receiver is the user
    if (receiver.toLowerCase() !== userAddress.toLowerCase()) {
      return this.blocked('Receiver address does not match user address', {
        expected: userAddress,
        actual: receiver,
      });
    }

    return this.safe();
  }

  /**
   * Validate WITHDRAW transaction (withdraw/redeem)
   */
  private validateWithdraw(
    tx: EVMTransaction,
    userAddress: string,
    chainId: number,
  ): ValidationResult {
    const resolved = this.resolveVault(tx, chainId);
    if ('error' in resolved) return resolved.error;
    const { vaultInfo } = resolved;

    // Check if vault withdrawals are disabled
    if (vaultInfo.canExit === false) {
      return this.blocked('Vault withdrawals are currently disabled', {
        vaultAddress: tx.to,
        chainId,
      });
    }

    // WITHDRAW should not send ETH
    const value = BigInt(tx.value ?? '0');
    if (value > 0n) {
      return this.blocked('Withdraw transaction should not send ETH', {
        value: value.toString(),
      });
    }

    // Parse the withdraw calldata
    const result = this.parseAndValidateCalldata(
      tx,
      ERC4626Validator.erc4626Interface,
    );
    if ('error' in result) return result.error;

    const { parsed } = result;

    // Check function is withdraw or redeem
    if (parsed.name !== 'withdraw' && parsed.name !== 'redeem') {
      return this.blocked('Invalid method for withdraw', {
        expected: 'withdraw or redeem',
        actual: parsed.name,
      });
    }

    // Both withdraw and redeem have: (amount, receiver, owner)
    const [amount, receiver, owner] = parsed.args;
    const amountBigInt = BigInt(amount);
    if (amountBigInt === 0n) {
      return this.blocked('Withdraw amount is zero');
    }

    // Validate owner is the user (they must own the shares)
    if (owner.toLowerCase() !== userAddress.toLowerCase()) {
      return this.blocked('Owner address does not match user address', {
        expected: userAddress,
        actual: owner,
      });
    }

    // Validate receiver is the user (for safety)
    if (receiver.toLowerCase() !== userAddress.toLowerCase()) {
      return this.blocked('Receiver address does not match user address', {
        expected: userAddress,
        actual: receiver,
      });
    }

    return this.safe();
  }

  /**
   * Validate UNWRAP transaction (WETH -> ETH)
   */
  private validateUnwrap(
    tx: EVMTransaction,
    chainId: number,
  ): ValidationResult {
    // Get WETH address for this chain
    const wethAddress = this.getWethAddress(chainId);
    if (!wethAddress) {
      return this.blocked('WETH address not configured for chain', { chainId });
    }

    const hasWethVault = Array.from(this.vaultInfoMap.values()).some(
      (v) => v.chainId === chainId && v.isWethVault === true,
    );
    if (!hasWethVault) {
      return this.blocked('No WETH vaults registered for this yield', {
        chainId,
      });
    }

    // Validate transaction is to WETH contract
    if (tx.to?.toLowerCase() !== wethAddress.toLowerCase()) {
      return this.blocked('UNWRAP transaction not to WETH contract', {
        expected: wethAddress,
        actual: tx.to,
      });
    }

    // UNWRAP should not send ETH
    const value = BigInt(tx.value ?? '0');
    if (value > 0n) {
      return this.blocked('UNWRAP transaction should not send ETH', {
        value: value.toString(),
      });
    }

    // Parse the unwrap calldata
    const result = this.parseAndValidateCalldata(
      tx,
      ERC4626Validator.wethInterface,
    );
    if ('error' in result) return result.error;

    const { parsed } = result;

    // Check function is withdraw
    if (parsed.name !== 'withdraw') {
      return this.blocked('Invalid method for unwrapping', {
        expected: 'withdraw',
        actual: parsed.name,
      });
    }

    // Validate amount is not zero
    const [amount] = parsed.args;
    const amountBigInt = BigInt(amount);
    if (amountBigInt === 0n) {
      return this.blocked('UNWRAP amount is zero');
    }

    return this.safe();
  }

  private resolveVault(
    tx: EVMTransaction,
    chainId: number,
  ): { vaultInfo: VaultInfo } | { error: ValidationResult } {
    const vaultAddress = tx.to?.toLowerCase();
    if (!vaultAddress) {
      return { error: this.blocked('Transaction has no destination address') };
    }

    if (!this.vaultInfoMap.has(`${chainId}:${vaultAddress}`)) {
      return {
        error: this.blocked('Vault address not whitelisted', {
          vaultAddress,
          chainId,
        }),
      };
    }

    const vaultInfo = this.vaultInfoMap.get(`${chainId}:${vaultAddress}`);
    if (!vaultInfo) {
      return {
        error: this.blocked('Vault address not whitelisted', {
          vaultAddress,
          chainId,
        }),
      };
    }

    return { vaultInfo };
  }

  /**
   * Get WETH address for a chain
   *
   */
  private getWethAddress(chainId: number): string | null {
    return WETH_ADDRESSES[chainId] || null;
  }
}
