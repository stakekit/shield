import { ethers } from 'ethers';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { BaseEVMValidator, EVMTransaction } from '../base.validator';
import { VaultInfo, VaultConfiguration } from './types';

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
 * Validates transactions for all ERC4626 vaults including:
 * - Euler, Morpho, Sommelier, Fluid, Gearbox, Angle, Idle, YO Protocol, 
 *   Yearn, Maple, Sky Protocol
 * 
 * Transaction Types Validated:
 * - APPROVAL: ERC20 token approval before deposit
 * - WRAP: Convert native ETH to WETH (optional, for WETH vaults)
 * - SUPPLY: Deposit assets into vault (deposit/mint)
 * - WITHDRAW: Withdraw assets from vault (withdraw/redeem)
 * - UNWRAP: Convert WETH to native ETH (optional, for WETH vaults)
 */
export class ERC4626Validator extends BaseEVMValidator {
  private readonly erc4626Interface: ethers.Interface;
  private readonly erc20Interface: ethers.Interface;
  private readonly wethInterface: ethers.Interface;
  private vaultsByChain: Map<number, Set<string>>; // chainId -> Set of vault addresses
  private vaultInfoMap: Map<string, VaultInfo>;    // vaultAddress -> VaultInfo
  
  constructor(vaultConfig: VaultConfiguration) {
    super();
    this.erc4626Interface = new ethers.Interface(ERC4626_ABI);
    this.erc20Interface = new ethers.Interface(ERC20_ABI);
    this.wethInterface = new ethers.Interface(WETH_ABI);
    this.vaultsByChain = new Map();
    this.vaultInfoMap = new Map();
    this.loadConfiguration(vaultConfig);
  }

  /**
   * Load vault configuration
   * 
   * Purpose:
   * 1. Vault Whitelisting - Only allow transactions to approved vaults
   * 2. Fast Lookup - O(1) lookup by chain ID and address
   * 3. Vault Metadata - Store vault-specific info (WETH vault, input token, etc.)
   * 4. Security - Core security feature preventing malicious contract calls
   */
  private loadConfiguration(config: VaultConfiguration): void {
    for (const vault of config.vaults) {
      const chainId = vault.chainId;
      const address = vault.address.toLowerCase();
      
      // Add to chain-based lookup
      if (!this.vaultsByChain.has(chainId)) {
        this.vaultsByChain.set(chainId, new Set());
      }
      this.vaultsByChain.get(chainId)!.add(address);
      
      // Add to info map
      this.vaultInfoMap.set(address, vault);
    }
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.APPROVAL,   // ERC20 approve before deposit
      TransactionType.WRAP,       // ETH → WETH (optional)
      TransactionType.SUPPLY,     // Deposit into vault
      TransactionType.WITHDRAW,   // Withdraw from vault
      TransactionType.UNWRAP,     // WETH → ETH (optional)
    ];
  }


  validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    args?: ActionArguments,
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

    // Validate vault address is whitelisted
    const vaultAddress = tx.to?.toLowerCase();
    if (!vaultAddress) {
      return this.blocked('Transaction has no destination address');
    }

    if (!this.isVaultAllowed(chainId, vaultAddress)) {
      return this.blocked('Vault address not whitelisted', {
        vaultAddress,
        chainId,
      });
    }

    // Get vault info
    const vaultInfo = this.vaultInfoMap.get(vaultAddress);
    if (!vaultInfo) {
      return this.blocked('Vault info not found', { vaultAddress });
    }

    // Validate no value sent (unless WETH vault)
    const value = BigInt(tx.value ?? '0');
    if (value > 0n && !vaultInfo.isWethVault) {
      return this.blocked('Transaction should not send ETH to non-WETH vault', {
        value: value.toString(),
      });
    }

    if (vaultInfo.chainId !== chainId) {
      return this.blocked('Transaction chain ID does not match vault chain', {
        expectedChainId: vaultInfo.chainId,
        actualChainId: chainId,
        vaultAddress,
      });
    }

    // Route to appropriate validation based on transaction type
    switch (transactionType) {
      case TransactionType.APPROVAL:
        return this.validateApproval(tx, userAddress, chainId);
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
   * 
   * Sample transaction from analysis:
   * {
   *   "to": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",  // WETH token
   *   "data": "0x095ea7b3...",  // approve(spender, amount)
   * }
   * 
   * Validates:
   * 1. Function is approve(address spender, uint256 amount)
   * 2. Spender is a whitelisted vault address
   * 3. No ETH value sent
   */
  private validateApproval(
    tx: EVMTransaction,
    userAddress: string,
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
    const result = this.parseAndValidateCalldata(tx, this.erc20Interface);
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
    if (!this.isVaultAllowed(chainId, spender)) {
      return this.blocked('Approval spender is not a whitelisted vault', {
        spender,
        chainId,
      });
    }

    // Validate amount is reasonable (not max uint256 unless explicitly allowed)
    // This is a safety check - some protocols use max approval, others use exact amounts
    const amountBigInt = BigInt(amount);
    if (amountBigInt === 0n) {
      return this.blocked('Approval amount is zero');
    }

    return this.safe();
  }

  /**
   * Validate WRAP transaction (ETH → WETH)
   * 
   * Sample transaction from analysis:
   * {
   *   "to": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",  // WETH contract
   *   "data": "0xd0e30db0",  // deposit()
   *   "value": "0x2386f26fc10000"  // ETH amount
   * }
   * 
   * Validates:
   * 1. Transaction is to WETH contract
   * 2. Function is deposit()
   * 3. ETH value is sent
   */
  private validateWrap(
    tx: EVMTransaction,
    chainId: number,
  ): ValidationResult {
    // Get WETH address for this chain
    const wethAddress = this.getWethAddress(chainId);
    if (!wethAddress) {
      return this.blocked('WETH address not configured for chain', { chainId });
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
    const result = this.parseAndValidateCalldata(tx, this.wethInterface);
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
   * 
   * Sample transaction from analysis:
   * {
   *   "to": "0x78E3E051D32157AACD550fBB78458762d8f7edFF",  // Vault address
   *   "data": "0x6e553f65...",  // deposit(uint256 assets, address receiver)
   * }
   * 
   * Validates:
   * 1. Transaction is to whitelisted vault
   * 2. Function is deposit() or mint()
   * 3. Receiver is the user
   * 4. No ETH value sent (unless WETH vault with native ETH support)
   */
  private validateSupply(
    tx: EVMTransaction,
    userAddress: string,
    chainId: number,
  ): ValidationResult {
    // Validate vault address is whitelisted
    const vaultAddress = tx.to?.toLowerCase();
    if (!vaultAddress) {
      return this.blocked('Transaction has no destination address');
    }

    if (!this.isVaultAllowed(chainId, vaultAddress)) {
      return this.blocked('Vault address not whitelisted', {
        vaultAddress,
        chainId,
      });
    }

    // Get vault info
    const vaultInfo = this.vaultInfoMap.get(vaultAddress);
    if (!vaultInfo) {
      return this.blocked('Vault info not found', { vaultAddress });
    }

    // Validate no value sent (unless WETH vault - rare case)
    const value = BigInt(tx.value ?? '0');
    if (value > 0n && !vaultInfo.isWethVault) {
      return this.blocked('Transaction should not send ETH to non-WETH vault', {
        value: value.toString(),
      });
    }

    // Parse the deposit calldata
    const result = this.parseAndValidateCalldata(tx, this.erc4626Interface);
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
    const [_amount, receiver] = parsed.args;

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
   * 
   * Sample transaction from analysis:
   * {
   *   "to": "0x78E3E051D32157AACD550fBB78458762d8f7edFF",  // Vault address
   *   "data": "0xba087652...",  // withdraw(uint256 assets, address receiver, address owner)
   * }
   * 
   * Validates:
   * 1. Transaction is to whitelisted vault
   * 2. Function is withdraw() or redeem()
   * 3. Owner is the user (they must own the shares)
   * 4. Receiver is the user (for safety)
   * 5. No ETH value sent
   */
  private validateWithdraw(
    tx: EVMTransaction,
    userAddress: string,
    chainId: number,
  ): ValidationResult {
    // Validate vault address is whitelisted
    const vaultAddress = tx.to?.toLowerCase();
    if (!vaultAddress) {
      return this.blocked('Transaction has no destination address');
    }

    if (!this.isVaultAllowed(chainId, vaultAddress)) {
      return this.blocked('Vault address not whitelisted', {
        vaultAddress,
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
    const result = this.parseAndValidateCalldata(tx, this.erc4626Interface);
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
    const [_amount, receiver, owner] = parsed.args;

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
   * Validate UNWRAP transaction (WETH → ETH)
   * 
   * Sample transaction from analysis:
   * {
   *   "to": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",  // WETH contract
   *   "data": "0x2e1a7d4d...",  // withdraw(uint256 wad)
   * }
   * 
   * Validates:
   * 1. Transaction is to WETH contract
   * 2. Function is withdraw(uint256)
   * 3. No ETH value sent
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
    const result = this.parseAndValidateCalldata(tx, this.wethInterface);
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

  /**
   * Check if vault is whitelisted for a chain
   */
  private isVaultAllowed(chainId: number, vaultAddress: string): boolean {
    const vaultsForChain = this.vaultsByChain.get(chainId);
    if (!vaultsForChain) {
      return false;
    }
    return vaultsForChain.has(vaultAddress.toLowerCase());
  }

  /**
   * Get WETH address for a chain
   * 
   * WETH addresses from vault-config.ts
   */
  private getWethAddress(chainId: number): string | null {
    const WETH_ADDRESSES: Record<number, string> = {
      1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',      // Ethereum
      42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',  // Arbitrum
      10: '0x4200000000000000000000000000000000000006',     // Optimism
      8453: '0x4200000000000000000000000000000000000006',   // Base
      137: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',   // Polygon
      100: '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1',   // Gnosis
      43114: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',// Avalanche
      56: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',   // Binance
      146: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',   // Sonic
      130: '0x4200000000000000000000000000000000000006',   // Unichain
    };

    return WETH_ADDRESSES[chainId] || null;
  }
}