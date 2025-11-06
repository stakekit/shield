
/**
 * Network & WETH Address Discovery Utility
 * 
 * This utility script discovers and verifies network-to-chainId mappings
 * and WETH addresses for ERC4626 vaults.
 * 
 * Usage:
 *   cd shield/parent/src/validators/evm/erc4626/scripts
 *   export YIELD_API_KEY="your-api-key"
 *   npx tsx discover-networks.ts
 * 
 * This will:
 * 1. Fetch all ERC4626 vaults from Yield API
 * 2. Discover all networks with ERC4626 support
 * 3. Extract chain IDs from sample transactions
 * 4. Find WETH addresses for each network
 * 5. Verify against current hardcoded values in ../vault-config.ts
 * 6. Generate updated mapping code
 */

import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface YieldToken {
  symbol: string;
  address?: string;
  decimals?: number;
  name?: string;
  network?: string;
}

interface YieldOpportunity {
  id: string;
  network: string;
  inputTokens: YieldToken[];
  token: YieldToken;
  outputToken?: YieldToken;
  providerId?: string;
  metadata?: any;
  status?: {
    enter?: boolean;
    exit?: boolean;
  };
}

interface Transaction {
  type: string;
  network: string;
  unsignedTransaction?: string;
}

interface ActionResponse {
  transactions: Transaction[];
}

interface NetworkInfo {
  network: string;
  chainId: number | null;
  vaultCount: number;
  wethAddress: string | null;
  wethVaults: string[]; // List of WETH vault IDs for verification
  sampleYieldId: string; // For fetching transactions
}

// ============================================================================
// NETWORK DISCOVERY CLASS
// ============================================================================

class NetworkDiscovery {
  private baseUrl = 'https://api.stakek.it/v1';
  private apiKey: string;
  private allYields: YieldOpportunity[] = [];
  private erc4626Yields: YieldOpportunity[] = [];
  private networks: Map<string, NetworkInfo> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch all yields from API
   */
  async fetchAllYields(): Promise<void> {
    console.log(`${colors.cyan}Fetching all yields from API...${colors.reset}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/yields`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      this.allYields = await response.json() as YieldOpportunity[];
      console.log(`${colors.green}✓ Fetched ${this.allYields.length} total yields${colors.reset}\n`);
    } catch (error) {
      console.error(`${colors.red}Failed to fetch yields:${colors.reset}`, error);
      throw error;
    }
  }

  /**
   * Filter for ERC4626 vaults using ID pattern
   */
  filterERC4626Yields(): void {
    console.log(`${colors.cyan}Filtering for ERC4626 vaults...${colors.reset}`);
    
    this.erc4626Yields = this.allYields.filter(y => 
      y.id.includes('-4626-vault') || y.id.includes('-4626-')
    );
    
    console.log(`${colors.green}✓ Found ${this.erc4626Yields.length} ERC4626 vaults${colors.reset}\n`);
  }

  /**
   * Discover networks and WETH addresses
   */
  async discoverNetworks(): Promise<void> {
    console.log(`${colors.cyan}Discovering networks and WETH addresses...${colors.reset}\n`);
    
    // Group vaults by network
    const networkGroups = new Map<string, YieldOpportunity[]>();
    
    for (const vault of this.erc4626Yields) {
      if (!networkGroups.has(vault.network)) {
        networkGroups.set(vault.network, []);
      }
      networkGroups.get(vault.network)!.push(vault);
    }
    
    console.log(`${colors.blue}Found ${networkGroups.size} unique networks${colors.reset}\n`);
    
    // Process each network
    for (const [network, vaults] of networkGroups.entries()) {
      console.log(`${colors.magenta}Processing ${network}...${colors.reset}`);
      
      // Find WETH vaults (token.symbol === 'WETH' or 'wETH')
      const wethVaults = vaults.filter(v => 
        v.token.symbol?.toUpperCase() === 'WETH' ||
        v.token.symbol?.toLowerCase() === 'weth'
      );
      
      const networkInfo: NetworkInfo = {
        network,
        chainId: null,
        vaultCount: vaults.length,
        wethAddress: null,
        wethVaults: wethVaults.map(v => v.id),
        sampleYieldId: vaults[0].id, // Use first vault for chain ID discovery
      };
      
      // Extract WETH address from first WETH vault
      if (wethVaults.length > 0) {
        const wethAddress = wethVaults[0].token.address;
        if (wethAddress) {
          networkInfo.wethAddress = wethAddress.toLowerCase();
          
          // Verify all WETH vaults have the same address
          const allSameAddress = wethVaults.every(v => 
            v.token.address?.toLowerCase() === wethAddress.toLowerCase()
          );
          
          if (allSameAddress) {
            console.log(`  ${colors.green}✓ WETH address: ${wethAddress}${colors.reset}`);
            console.log(`  ${colors.gray}  Verified across ${wethVaults.length} WETH vault(s)${colors.reset}`);
          } else {
            console.log(`  ${colors.yellow}⚠ WETH address: ${wethAddress} (inconsistent across vaults!)${colors.reset}`);
          }
        } else {
          console.log(`  ${colors.yellow}⚠ WETH vault found but no address${colors.reset}`);
        }
      } else {
        console.log(`  ${colors.yellow}⚠ No WETH vaults found${colors.reset}`);
      }
      
      console.log(`  ${colors.gray}  Total vaults: ${vaults.length}${colors.reset}`);
      
      this.networks.set(network, networkInfo);
    }
    
    console.log();
  }

  /**
   * Fetch chain IDs from sample transactions
   */
  async fetchChainIds(): Promise<void> {
    console.log(`${colors.cyan}Fetching chain IDs from sample transactions...${colors.reset}\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const [network, info] of this.networks.entries()) {
      console.log(`${colors.magenta}Fetching chain ID for ${network}...${colors.reset}`);
      
      try {
        // Fetch enter action for sample vault
        const response = await fetch(
          `${this.baseUrl}/actions/enter`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
            },
            body: JSON.stringify({
              yieldId: info.sampleYieldId,
              address: '0x0000000000000000000000000000000000000001', // Dummy address
              arguments: {
                amount: '0.001',
              },
            }),
          }
        );

        if (!response.ok) {
          console.log(`  ${colors.yellow}⚠ Failed to fetch transaction: ${response.status}${colors.reset}`);
          failCount++;
          continue;
        }

        const actionData: ActionResponse = await response.json() as ActionResponse;
        
        // Extract chainId from first transaction
        if (actionData.transactions && actionData.transactions.length > 0) {
          const tx = actionData.transactions[0];
          if (tx.unsignedTransaction) {
            const txData = JSON.parse(tx.unsignedTransaction);
            if (txData.chainId) {
              info.chainId = txData.chainId;
              console.log(`  ${colors.green}✓ Chain ID: ${txData.chainId}${colors.reset}`);
              successCount++;
            } else {
              console.log(`  ${colors.yellow}⚠ No chainId in transaction${colors.reset}`);
              failCount++;
            }
          } else {
            console.log(`  ${colors.yellow}⚠ No unsignedTransaction field${colors.reset}`);
            failCount++;
          }
        } else {
          console.log(`  ${colors.yellow}⚠ No transactions in response${colors.reset}`);
          failCount++;
        }
        
        // Rate limiting
        await this.sleep(100);
        
      } catch (error) {
        console.log(`  ${colors.red}✗ Error: ${error}${colors.reset}`);
        failCount++;
      }
    }
    
    console.log();
    console.log(`${colors.green}✓ Successfully fetched ${successCount} chain IDs${colors.reset}`);
    if (failCount > 0) {
      console.log(`${colors.yellow}⚠ Failed to fetch ${failCount} chain IDs${colors.reset}`);
    }
    console.log();
  }

  /**
   * Verify against current hardcoded values
   */
  verifyAgainstCurrent(): void {
    console.log(`${colors.cyan}${colors.bold}Verification Against Current Hardcoded Values:${colors.reset}\n`);
    
    // Current hardcoded values from vault-config.ts
    const CURRENT_NETWORK_TO_CHAIN_ID: Record<string, number> = {
      ethereum: 1,
      base: 8453,
      binance: 56,
      sonic: 146,
      unichain: 130,
      arbitrum: 42161,
      avalanche: 43114,
      polygon: 137,
      katana: 747474,
      optimism: 10,
      gnosis: 100,
    };
    
    const CURRENT_WETH_ADDRESSES: Record<number, string> = {
      1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      8453: '0x4200000000000000000000000000000000000006',
      56: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      146: '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b',
      130: '0x4200000000000000000000000000000000000006',
      42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      43114: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
      137: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      10: '0x4200000000000000000000000000000000000006',
      100: '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1',
    };
    
    // Check network-to-chainId mappings
    console.log(`${colors.bold}Network-to-ChainID Mappings:${colors.reset}\n`);
    
    let matchCount = 0;
    let mismatchCount = 0;
    let newCount = 0;
    let missingChainIdCount = 0;
    
    for (const [network, info] of this.networks.entries()) {
      const currentChainId = CURRENT_NETWORK_TO_CHAIN_ID[network];
      const discoveredChainId = info.chainId;
      
      if (!discoveredChainId) {
        console.log(`${colors.yellow}⚠ ${network}: No chain ID discovered${colors.reset}`);
        missingChainIdCount++;
      } else if (!currentChainId) {
        console.log(`${colors.cyan}+ ${network}: NEW network (chainId: ${discoveredChainId})${colors.reset}`);
        newCount++;
      } else if (currentChainId === discoveredChainId) {
        console.log(`${colors.green}✓ ${network}: ${discoveredChainId} (matches)${colors.reset}`);
        matchCount++;
      } else {
        console.log(`${colors.red}✗ ${network}: Current=${currentChainId}, Discovered=${discoveredChainId} (MISMATCH!)${colors.reset}`);
        mismatchCount++;
      }
    }
    
    // Check for networks in current config but not discovered
    for (const network of Object.keys(CURRENT_NETWORK_TO_CHAIN_ID)) {
      if (!this.networks.has(network)) {
        console.log(`${colors.gray}- ${network}: In config but no ERC4626 vaults found${colors.reset}`);
      }
    }
    
    console.log();
    console.log(`${colors.bold}Summary:${colors.reset} ${matchCount} matches, ${newCount} new, ${mismatchCount} mismatches, ${missingChainIdCount} missing chain IDs`);
    console.log();
    
    // Check WETH addresses
    console.log(`${colors.bold}WETH Addresses:${colors.reset}\n`);
    
    let wethMatchCount = 0;
    let wethMismatchCount = 0;
    let wethNewCount = 0;
    let wethMissingCount = 0;
    
    for (const [network, info] of this.networks.entries()) {
      if (!info.chainId) continue;
      
      const currentWeth = CURRENT_WETH_ADDRESSES[info.chainId];
      const discoveredWeth = info.wethAddress;
      
      if (!discoveredWeth) {
        console.log(`${colors.yellow}⚠ ${network} (${info.chainId}): No WETH address discovered${colors.reset}`);
        wethMissingCount++;
      } else if (!currentWeth) {
        console.log(`${colors.cyan}+ ${network} (${info.chainId}): NEW WETH address${colors.reset}`);
        console.log(`  ${colors.gray}  ${discoveredWeth}${colors.reset}`);
        wethNewCount++;
      } else if (currentWeth.toLowerCase() === discoveredWeth.toLowerCase()) {
        console.log(`${colors.green}✓ ${network} (${info.chainId}): ${discoveredWeth} (matches)${colors.reset}`);
        wethMatchCount++;
      } else {
        console.log(`${colors.red}✗ ${network} (${info.chainId}): MISMATCH!${colors.reset}`);
        console.log(`  ${colors.gray}  Current:    ${currentWeth}${colors.reset}`);
        console.log(`  ${colors.gray}  Discovered: ${discoveredWeth}${colors.reset}`);
        wethMismatchCount++;
      }
    }
    
    console.log();
    console.log(`${colors.bold}Summary:${colors.reset} ${wethMatchCount} matches, ${wethNewCount} new, ${wethMismatchCount} mismatches, ${wethMissingCount} no WETH`);
    console.log();
  }

  /**
   * Generate updated code for vault-config.ts
   */
  generateUpdatedCode(): void {
    console.log(`${colors.cyan}${colors.bold}Generated Code for vault-config.ts:${colors.reset}\n`);
    console.log(`${colors.gray}Copy and paste the following into ../vault-config.ts${colors.reset}\n`);
    console.log(`${'='.repeat(80)}\n`);
    
    // Sort networks by name
    const sortedNetworks = Array.from(this.networks.entries())
      .filter(([_, info]) => info.chainId !== null)
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    // Generate FALLBACK_NETWORK_TO_CHAIN_ID
    console.log(`${colors.bold}/**`);
    console.log(` * Minimal fallback network mapping (only most common EVM networks)`);
    console.log(` * This is used as a fallback if dynamic discovery fails`);
    console.log(` */`);
    console.log(`const FALLBACK_NETWORK_TO_CHAIN_ID: Record<string, number> = {${colors.reset}`);
    for (const [network, info] of sortedNetworks) {
      const padding = ' '.repeat(Math.max(2, 12 - network.length));
      console.log(`  ${network}:${padding}${info.chainId},`);
    }
    console.log(`};`);
    console.log();
    
    // Generate WETH_ADDRESSES
    const wethEntries = sortedNetworks
      .filter(([_, info]) => info.wethAddress !== null)
      .sort((a, b) => a[1].chainId! - b[1].chainId!);
    
    console.log(`${colors.bold}/**`);
    console.log(` * WETH addresses by chain ID`);
    console.log(` * These are standardized addresses that rarely change`);
    console.log(` */`);
    console.log(`const WETH_ADDRESSES: Record<number, string> = {${colors.reset}`);
    for (const [network, info] of wethEntries) {
      const chainIdStr = info.chainId!.toString();
      const padding = ' '.repeat(Math.max(2, 6 - chainIdStr.length));
      const networkName = network.charAt(0).toUpperCase() + network.slice(1);
      console.log(`  ${chainIdStr}:${padding}'${info.wethAddress}',  // ${networkName}`);
    }
    console.log(`};`);
    console.log();
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Generate summary report
   */
  generateReport(): void {
    console.log(`${colors.cyan}${colors.bold}Discovery Summary:${colors.reset}\n`);
    
    console.log(`Total yields fetched:        ${this.allYields.length}`);
    console.log(`ERC4626 vaults found:        ${this.erc4626Yields.length}`);
    console.log(`Unique networks:             ${this.networks.size}`);
    console.log(`Networks with chain IDs:     ${Array.from(this.networks.values()).filter(n => n.chainId !== null).length}`);
    console.log(`Networks with WETH:          ${Array.from(this.networks.values()).filter(n => n.wethAddress !== null).length}`);
    console.log();
    
    // Network breakdown
    console.log(`${colors.bold}Network Breakdown:${colors.reset}\n`);
    
    const sortedByCount = Array.from(this.networks.entries())
      .sort((a, b) => b[1].vaultCount - a[1].vaultCount);
    
    for (const [network, info] of sortedByCount) {
      const chainIdStr = info.chainId ? `chainId: ${info.chainId}` : 'chainId: unknown';
      const wethStr = info.wethAddress ? '✓ WETH' : '✗ No WETH';
      console.log(`  ${network.padEnd(15)} ${chainIdStr.padEnd(20)} ${wethStr.padEnd(15)} ${info.vaultCount} vaults`);
    }
    console.log();
    
    // Save JSON report
    const reportData = {
      summary: {
        totalYields: this.allYields.length,
        erc4626Vaults: this.erc4626Yields.length,
        uniqueNetworks: this.networks.size,
        networksWithChainIds: Array.from(this.networks.values()).filter(n => n.chainId !== null).length,
        networksWithWeth: Array.from(this.networks.values()).filter(n => n.wethAddress !== null).length,
      },
      networks: Array.from(this.networks.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([network, info]) => ({
          network,
          chainId: info.chainId,
          vaultCount: info.vaultCount,
          wethAddress: info.wethAddress,
          wethVaultCount: info.wethVaults.length,
          sampleWethVaults: info.wethVaults.slice(0, 5), // First 5 for verification
        })),
    };
    
    const outputPath = path.join(__dirname, 'network-discovery-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
    
    console.log(`${colors.green}✓ Detailed report saved to: ${outputPath}${colors.reset}\n`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const apiKey = process.env.YIELD_API_KEY;
  
  if (!apiKey) {
    console.error(`${colors.red}Error: YIELD_API_KEY environment variable not set${colors.reset}`);
    console.log('Please set your API key: export YIELD_API_KEY="your-api-key"');
    process.exit(1);
  }

  console.log(`\n${colors.cyan}${colors.bold}${'🔍 NETWORK & WETH ADDRESS DISCOVERY'.padStart(60)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}${'Discovering networks and WETH addresses from Yield API'.padStart(65)}${colors.reset}\n`);
  console.log(`${'='.repeat(80)}\n`);

  const discovery = new NetworkDiscovery(apiKey);

  try {
    // Step 1: Fetch all yields
    await discovery.fetchAllYields();

    // Step 2: Filter ERC4626 yields
    discovery.filterERC4626Yields();

    // Step 3: Discover networks and WETH addresses
    await discovery.discoverNetworks();

    // Step 4: Fetch chain IDs from transactions
    await discovery.fetchChainIds();

    // Step 5: Verify against current values
    discovery.verifyAgainstCurrent();

    // Step 6: Generate updated code
    discovery.generateUpdatedCode();

    // Step 7: Generate summary report
    discovery.generateReport();

    console.log(`${colors.green}${colors.bold}🎉 Discovery complete!${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the discovery
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});