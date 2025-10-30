import { VaultConfiguration, VaultInfo } from './types';

// API configuration
const STAKEKIT_API_BASE = 'https://api.stakek.it/v1';
const YIELDS_ENDPOINT = `${STAKEKIT_API_BASE}/yields`;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

// In-memory cache
let cachedConfig: VaultConfiguration | null = null;
let lastFetchTime: number = 0;

/**
 * Network name to chain ID mapping
 */
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  'ethereum-goerli': 5,
  'ethereum-holesky': 17000,
  'ethereum-sepolia': 11155111,
  'ethereum-hoodi': 560048,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  'polygon-amoy': 80002,
  base: 8453,
  'base-sepolia': 84532,
  gnosis: 100,
  'avalanche-c': 43114,
  binance: 56,
  fantom: 250,
  harmony: 1666600000,
  celo: 42220,
  viction: 88,
  linea: 59144,
  zksync: 324,
  core: 1116,
  sonic: 146,
  unichain: 130,
  katana: 747474,
  hyperevm: 999,
};

/**
 * WETH addresses by chain ID
 */
const WETH_ADDRESSES: Record<number, string> = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',      // Ethereum
  42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',  // Arbitrum
  10: '0x4200000000000000000000000000000000000006',     // Optimism
  8453: '0x4200000000000000000000000000000000000006',   // Base
  137: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',   // Polygon
  100: '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1',   // Gnosis (WETH)
  43114: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',// Avalanche (WETH.e)
  56: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',   // Binance (ETH)
  250: '0x74b23882a30290451a17c44f4f05243b6b58c76d',  // Fantom (WETH)
  42220: '0x122013fd7df1c6f636a5bb8f03108e876548b455', // Celo (WETH)
  59144: '0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f', // Linea (WETH)
  324: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',   // zkSync (WETH)
};

/**
 * Fetch all ERC4626 vaults from StakeKit API
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
    
    // Filter for ERC4626 vaults
    const erc4626Yields = data.filter((yieldData: any) => 
      yieldData.supportedStandards?.includes('ERC4626')
    );
    
    // Transform to VaultInfo format
    const vaults = transformToVaultInfo(erc4626Yields);
    
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
      // Extract vault address from contractAddresses
      const vaultAddress = yieldData.contractAddresses?.[0];
      if (!vaultAddress) {
        console.warn(`No contract address found for yield ${yieldData.id}`);
        continue;
      }
      
      // Get chain ID from network
      const chainId = NETWORK_TO_CHAIN_ID[yieldData.token.network];
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
        network: yieldData.token.network,
        isWethVault,
      };
      
      vaults.push(vaultInfo);
      
    } catch (error) {
      console.error(`Failed to transform yield ${yieldData.id}:`, error);
    }
  }
  
  return vaults;
}

/**
 * Extract protocol name from yield data
 */
function extractProtocol(yieldData: any): string {
  // Try provider name first
  if (yieldData.provider?.name) {
    return yieldData.provider.name.toLowerCase();
  }
  
  // Try to extract from yield ID
  const knownProtocols = [
    'morpho', 'angle', 'euler', 'fluid', 'gearbox',
    'idle', 'sky', 'spark', 'yearn', 'maple', 'yo',
  ];
  
  for (const protocol of knownProtocols) {
    if (yieldData.id.toLowerCase().includes(protocol)) {
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