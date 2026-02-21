import registryData from './vault-registry.json';
import { VaultConfiguration, VaultInfo } from './types';

interface RegistryEntry {
  yieldId: string;
  address: string;
  chainId: number;
  protocol: string;
  network: string;
  inputTokenAddress: string;
  vaultTokenAddress: string;
  isWethVault: boolean;
  canEnter?: boolean;
  canExit?: boolean;
}

interface VaultRegistry {
  version: number;
  generatedAt: string;
  vaults: RegistryEntry[];
}

export function loadEmbeddedRegistry(): VaultConfiguration {
  const registry = registryData as VaultRegistry;

  const vaults: VaultInfo[] = registry.vaults.map((entry) => ({
    address: entry.address.toLowerCase(),
    chainId: entry.chainId,
    protocol: entry.protocol,
    yieldId: entry.yieldId,
    inputTokenAddress: entry.inputTokenAddress.toLowerCase(),
    vaultTokenAddress: entry.vaultTokenAddress.toLowerCase(),
    network: entry.network,
    isWethVault: entry.isWethVault,
    canEnter: entry.canEnter,
    canExit: entry.canExit,
  }));

  return {
    vaults,
    lastUpdated: new Date(registry.generatedAt).getTime(),
  };
}
