/**
 * Vault information from API
 */
export interface VaultInfo {
  address: string; // Vault contract address (lowercase)
  chainId: number; // EVM chain ID
  protocol: string; // e.g., 'morpho', 'angle', 'euler'
  yieldId: string; // StakeKit yield ID
  inputTokenAddress: string; // Token being deposited
  vaultTokenAddress: string; // Vault share token
  network: string; // e.g., 'ethereum', 'arbitrum'
  isWethVault?: boolean; // Supports native ETH deposits
  canEnter?: boolean; // Whether deposits are enabled
  canExit?: boolean; // Whether withdrawals are enabled
  allocatorVaults?: string[]; // Allocator vault addresses (ERC4626-compatible)
  /** Base vault token decimals — used for redeem margin when tx.to is an allocator (non-kiln). */
  inputTokenDecimals?: number;
  vaultTokenDecimals?: number;
}

/**
 * Configuration for all vaults
 */
export interface VaultConfiguration {
  vaults: VaultInfo[];
  lastUpdated: number; // Timestamp of last fetch
}
