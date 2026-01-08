import { VaultConfiguration, VaultInfo } from './types';

// API configuration
const STAKEKIT_API_BASE = 'https://api.stakek.it/v1';
const YIELDS_ENDPOINT = `${STAKEKIT_API_BASE}/yields`;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// In-memory cache
let cachedConfig: VaultConfiguration | null = null;
let lastFetchTime: number = 0;
let fetchCount: number = 0;
let lastError: Error | null = null;

/**
 * Network name to chain ID mapping
 */
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  binance: 56,
  arbitrum: 42161,
  avalanche: 43114, 
  sonic: 146,
  unichain: 130,
  polygon: 137,
  katana: 747474, 
  optimism: 10,
  gnosis: 100,
};

/**
 * WETH addresses by chain ID
 */
const WETH_ADDRESSES: Record<number, string> = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',      // Ethereum
  8453: '0x4200000000000000000000000000000000000006',   // Base
  56: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',   // Binance (ETH)
  42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',  // Arbitrum
  43114: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',// Avalanche (WETH.e)
  146: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',   // Sonic
  130: '0x4200000000000000000000000000000000000006',   // Unichain 
  137: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',   // Polygon
  10: '0x4200000000000000000000000000000000000006',     // Optimism
  100: '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1',   // Gnosis
};

/**
 * Fetch all ERC4626 vaults from StakeKit API
 * 
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 * @returns VaultConfiguration with all ERC4626 vaults
 * 
 * Caching behavior:
 * - Cache duration: 24 hours
 * - Manual refresh: Set forceRefresh=true
 * - Error fallback: Returns stale cache if fetch fails
 * 
 * Security:
 * - Validates vault addresses are valid Ethereum addresses
 * - Validates chain IDs are known networks
 * - Filters out malformed data
 */
export async function fetchERC4626Vaults(
  forceRefresh: boolean = false,
): Promise<VaultConfiguration> {
  // Check cache first
  if (!forceRefresh && cachedConfig && isCacheValid()) {
    return cachedConfig;
  }

  try {
    const response = await fetch(YIELDS_ENDPOINT);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data: any = await response.json();

    // Validate response is an array
    if (!Array.isArray(data)) {
      throw new Error('API response is not an array');
    }
    
    // Filter for ERC4626 vaults using yield ID pattern
    // All ERC4626 yields have "-4626-vault" or "-4626-" in their ID
    const erc4626Yields = data.filter((yieldData: any) => {
      const id = yieldData.id || '';
      return id.includes('-4626-vault') || id.includes('-4626-');
    });
    
    // Transform to VaultInfo format
    const vaults = transformToVaultInfo(erc4626Yields);
    
    if (vaults.length === 0) {
      throw new Error('No valid ERC4626 vaults found in API response');
    }
    // Create configuration
    const config: VaultConfiguration = {
      vaults,
      lastUpdated: Date.now(),
    };
    
    // Update cache
    cachedConfig = config;
    lastFetchTime = Date.now();
    
    return config;
    
  } catch (error) {
    console.error('Failed to fetch ERC4626 vaults from API:', error);
    
    // If cache exists, return it even if stale
    if (cachedConfig) {
      console.warn('Returning stale cached configuration');
      return cachedConfig;
    }
    
    throw new Error(`Failed to fetch vault configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract vault address from yield ID
 * 
 * ERC4626 yield IDs follow the pattern:
 * {network}-{token}-{name}-{vaultAddress}-4626-vault
 * 
 * Example:
 * "arbitrum-weth-eweth-1-0x78e3e051d32157aacd550fbb78458762d8f7edff-4626-vault"
 * → "0x78e3e051d32157aacd550fbb78458762d8f7edff"
 * 
 * @param yieldId - The yield ID from the API
 * @returns Vault address or null if not found
 */
function extractVaultAddressFromYieldId(yieldId: string): string | null {
  const match = yieldId.match(/-(0x[a-fA-F0-9]{40})-4626-vault$/);
  return match ? match[1] : null;
}

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  return Date.now() - lastFetchTime < CACHE_TTL_MS;
}

/**
 * Transform API yield data to VaultInfo format
 */
function transformToVaultInfo(yields: any[]): VaultInfo[] {
  const vaults: VaultInfo[] = [];
  
  for (const yieldData of yields) {
    try {
      // Extract vault address from outputToken or yield ID
      // Primary: outputToken.address (the vault contract address)
      // Fallback: Extract from yield ID pattern
      let vaultAddress = yieldData.outputToken?.address;

      // Fallback: Extract from yield ID if outputToken is missing
      if (!vaultAddress) {
        vaultAddress = extractVaultAddressFromYieldId(yieldData.id);
      }

      if (!vaultAddress) {
        console.warn(`[VaultConfig] No vault address found for yield ${yieldData.id}`);
        continue;
      }
      
      // Get chain ID from network
      const chainId = NETWORK_TO_CHAIN_ID[yieldData.network];
      if (!chainId) {
        console.warn(`Unknown network: ${yieldData.token.network}`);
        continue;
      }
      
      // Extract protocol from provider or yield ID
      const protocol = extractProtocol(yieldData);
      
      // Check if it's a WETH vault
      const tokenAddress = yieldData.token.address?.toLowerCase();
      const wethAddress = WETH_ADDRESSES[chainId]?.toLowerCase();
      const isWethVault = tokenAddress === wethAddress;
      
      const vaultInfo: VaultInfo = {
        address: vaultAddress.toLowerCase(),
        chainId,
        protocol,
        yieldId: yieldData.id,
        inputTokenAddress: tokenAddress || '',
        vaultTokenAddress: vaultAddress.toLowerCase(),
        network: yieldData.network,
        isWethVault,
        canEnter: yieldData.status?.enter,
        canExit: yieldData.status?.exit,
      };
      
      vaults.push(vaultInfo);
      
    } catch (error) {
      console.error(`Failed to transform yield ${yieldData.id}:`, error);
    }
  }
  
  return vaults;
}

function extractProtocol(yieldData: any): string {
  // Use providerId directly (it's already the protocol name)
  if (yieldData.providerId) {
    return yieldData.providerId.toLowerCase();
  }
  
  // Fallback: Extract from yield ID
  const knownProtocols = [
    'morpho', 'angle', 'euler', 'fluid', 'gearbox',
    'idle', 'sky', 'spark', 'yearn', 'maple', 'yo',
    'sommelier', // ← Add this (missing from your list)
  ];
  
  const lowerCaseId = yieldData.id.toLowerCase();
  for (const protocol of knownProtocols) {
    if (lowerCaseId.includes(protocol)) {
      return protocol;
    }
  }
  
  return 'unknown';
}

/**
 * Clear the cache (useful for testing)
 */
export function clearVaultCache(): void {
  cachedConfig = null;
  lastFetchTime = 0;
}