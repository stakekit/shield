import { loadEmbeddedRegistry } from './vault-config';
import registryData from './vault-registry.json';
import { validatorRegistry, GENERIC_ERC4626_PROTOCOLS } from '../../index';

describe('vault-registry.json integrity', () => {
  const registry = registryData as {
    version: number;
    generatedAt: string;
    vaults: Array<Record<string, unknown>>;
  };

  it('should parse as valid JSON with required top-level fields', () => {
    expect(registry.version).toBe(1);
    expect(typeof registry.generatedAt).toBe('string');
    expect(Array.isArray(registry.vaults)).toBe(true);
    expect(registry.vaults.length).toBeGreaterThan(0);
  });

  it('should have all required fields on every vault entry', () => {
    const requiredFields = [
      'yieldId',
      'address',
      'chainId',
      'protocol',
      'network',
      'inputTokenAddress',
      'vaultTokenAddress',
      'isWethVault',
    ];
    for (const vault of registry.vaults) {
      for (const field of requiredFields) {
        expect(vault).toHaveProperty(field);
      }
    }
  });

  it('should have all addresses in lowercase', () => {
    for (const vault of registry.vaults as any[]) {
      expect(vault.address).toBe(vault.address.toLowerCase());
      expect(vault.inputTokenAddress).toBe(
        vault.inputTokenAddress.toLowerCase(),
      );
      expect(vault.vaultTokenAddress).toBe(
        vault.vaultTokenAddress.toLowerCase(),
      );
    }
  });

  it('should be sorted by yieldId', () => {
    const yieldIds = (registry.vaults as any[]).map((v) => v.yieldId);
    const sorted = [...yieldIds].sort((a, b) => a.localeCompare(b));
    expect(yieldIds).toEqual(sorted);
  });
});

describe('loadEmbeddedRegistry()', () => {
  it('should return a valid VaultConfiguration', () => {
    const config = loadEmbeddedRegistry();
    expect(config.lastUpdated).toBeGreaterThan(0);
    expect(Array.isArray(config.vaults)).toBe(true);
    expect(config.vaults.length).toBeGreaterThan(0);
  });

  it('should have yieldId on every vault for registration', () => {
    const config = loadEmbeddedRegistry();
    for (const vault of config.vaults) {
      expect(typeof vault.yieldId).toBe('string');
      expect(vault.yieldId.length).toBeGreaterThan(0);
    }
  });
});

describe('validator registry integration', () => {
  it('should register every allowed-protocol yieldId from the embedded registry', () => {
    const config = loadEmbeddedRegistry();

    for (const vault of config.vaults) {
      if (GENERIC_ERC4626_PROTOCOLS.has(vault.protocol)) {
        expect(validatorRegistry.has(vault.yieldId)).toBe(true);
      } else {
        expect(validatorRegistry.has(vault.yieldId)).toBe(false);
      }
    }
  });
});
