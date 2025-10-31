import { ethers } from 'ethers';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../../types';
import { BaseEVMValidator, EVMTransaction } from '../base.validator';
import { VaultInfo, VaultConfiguration, ERC4626ValidationContext } from './types';

/**
 * Standard ERC4626 ABI - only the functions we need to validate
 */
const ERC4626_ABI = [
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function mint(uint256 shares, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
];

export class ERC4626Validator extends BaseEVMValidator {
  private readonly erc4626Interface: ethers.Interface;
  private vaultsByChain: Map<number, Set<string>>; // chainId -> Set of vault addresses
  private vaultInfoMap: Map<string, VaultInfo>;    // vaultAddress -> VaultInfo
  
  constructor(vaultConfig: VaultConfiguration) {
    super();
    this.erc4626Interface = new ethers.Interface(ERC4626_ABI);
    this.vaultsByChain = new Map();
    this.vaultInfoMap = new Map();
    this.loadConfiguration(vaultConfig);
  }

  /**
   * Load vault configuration
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
        TransactionType.APPROVAL, 
        TransactionType.WRAP,      
        TransactionType.UNWRAP,
        TransactionType.STAKE, 
        TransactionType.UNSTAKE
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

    // Validate chain ID if provided
    if (args?.chainId) {
      const chainErr = this.ensureChainIdEquals(tx, args.chainId);
      if (chainErr) return chainErr;
    }

    // Get chain ID
    const chainId = tx.chainId ?? args?.chainId;
    if (!chainId) {
      return this.blocked('Chain ID not provided');
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

    // Route to appropriate validation based on transaction type
    switch (transactionType) {
      case TransactionType.STAKE:
        return this.validateStake(tx, userAddress);
      case TransactionType.UNSTAKE:
        return this.validateUnstake(tx, userAddress);
      default:
        return this.blocked('Unsupported transaction type', {
          transactionType,
        });
    }
  }

  /**
   * Validate deposit/mint transaction
   */
  private validateStake(
    tx: EVMTransaction,
    userAddress: string,
  ): ValidationResult {
    const result = this.parseAndValidateCalldata(tx, this.erc4626Interface);
    if ('error' in result) return result.error;

    const { parsed } = result;

    // Check function is deposit or mint
    if (parsed.name !== 'deposit' && parsed.name !== 'mint') {
      return this.blocked('Invalid method for staking', {
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
   * Validate withdraw/redeem transaction
   */
  private validateUnstake(
    tx: EVMTransaction,
    userAddress: string,
  ): ValidationResult {
    const result = this.parseAndValidateCalldata(tx, this.erc4626Interface);
    if ('error' in result) return result.error;

    const { parsed } = result;

    // Check function is withdraw or redeem
    if (parsed.name !== 'withdraw' && parsed.name !== 'redeem') {
      return this.blocked('Invalid method for unstaking', {
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
   * Check if vault is whitelisted for a chain
   */
  private isVaultAllowed(chainId: number, vaultAddress: string): boolean {
    const vaultsForChain = this.vaultsByChain.get(chainId);
    if (!vaultsForChain) {
      return false;
    }
    return vaultsForChain.has(vaultAddress.toLowerCase());
  }
}