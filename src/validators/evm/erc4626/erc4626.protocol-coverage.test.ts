import { ethers } from 'ethers';
import { ERC4626Validator } from './erc4626.validator';
import { loadEmbeddedRegistry } from './vault-config';
import { VaultInfo } from './types';
import { TransactionType } from '../../../types';

import { GENERIC_ERC4626_PROTOCOLS } from '../../index';

const erc20Iface = new ethers.Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
]);
const erc4626Iface = new ethers.Interface([
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
]);
const wethIface = new ethers.Interface([
  'function deposit() payable',
  'function withdraw(uint256 wad)',
]);

const WETH_ADDRESSES: Record<number, string> = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  10: '0x4200000000000000000000000000000000000006',
  8453: '0x4200000000000000000000000000000000000006',
  137: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  100: '0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1',
  43114: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
  56: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
  146: '0x50c42deacd8fc9773493ed674b675be577f2634b',
  130: '0x4200000000000000000000000000000000000006',
};

const USER = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';

function buildTx(fields: Record<string, unknown>): string {
  return JSON.stringify({
    from: USER,
    nonce: 0,
    gasLimit: '0x30d40',
    maxFeePerGas: '0x6fc23ac00',
    maxPriorityFeePerGas: '0x3b9aca00',
    type: 2,
    ...fields,
  });
}

const config = loadEmbeddedRegistry();

// Pick one active (canEnter + canExit) vault per protocol
const sampleByProtocol = new Map<string, VaultInfo>();
for (const vault of config.vaults) {
  if (
    GENERIC_ERC4626_PROTOCOLS.has(vault.protocol) &&
    !sampleByProtocol.has(vault.protocol) &&
    vault.canEnter !== false &&
    vault.canExit !== false
  ) {
    sampleByProtocol.set(vault.protocol, vault);
  }
}

describe('ERC4626 protocol coverage — real vaults from embedded registry', () => {
  it('should have at least one active vault per allowed protocol', () => {
    const missing: string[] = [];
    for (const protocol of GENERIC_ERC4626_PROTOCOLS) {
      if (!sampleByProtocol.has(protocol)) missing.push(protocol);
    }
    expect(missing).toEqual([]);
  });

  for (const [protocol, vault] of sampleByProtocol) {
    describe(`${protocol} — ${vault.yieldId}`, () => {
      const validator = new ERC4626Validator({
        vaults: [vault],
        lastUpdated: config.lastUpdated,
      });

      it('APPROVAL: approve(vault, amount)', () => {
        const data = erc20Iface.encodeFunctionData('approve', [
          vault.address,
          ethers.parseUnits('100', 18),
        ]);
        const tx = buildTx({
          to: vault.inputTokenAddress,
          data,
          value: '0x0',
          chainId: vault.chainId,
        });
        const result = validator.validate(tx, TransactionType.APPROVAL, USER);
        expect(result.isValid).toBe(true);
      });

      it('SUPPLY: deposit(amount, receiver)', () => {
        const data = erc4626Iface.encodeFunctionData('deposit', [
          ethers.parseUnits('100', 18),
          USER,
        ]);
        const tx = buildTx({
          to: vault.address,
          data,
          value: '0x0',
          chainId: vault.chainId,
        });
        const result = validator.validate(tx, TransactionType.SUPPLY, USER);
        expect(result.isValid).toBe(true);
      });

      it('WITHDRAW: redeem(shares, receiver, owner)', () => {
        const data = erc4626Iface.encodeFunctionData('redeem', [
          ethers.parseUnits('50', 18),
          USER,
          USER,
        ]);
        const tx = buildTx({
          to: vault.address,
          data,
          value: '0x0',
          chainId: vault.chainId,
        });
        const result = validator.validate(tx, TransactionType.WITHDRAW, USER);
        expect(result.isValid).toBe(true);
      });
    });
  }
});

describe('WETH vault coverage', () => {
  const wethVault = config.vaults.find(
    (v) =>
      v.isWethVault === true &&
      v.canEnter !== false &&
      v.canExit !== false &&
      GENERIC_ERC4626_PROTOCOLS.has(v.protocol) &&
      WETH_ADDRESSES[v.chainId],
  );

  it('should have at least one WETH vault in the registry', () => {
    expect(wethVault).toBeDefined();
  });

  if (wethVault) {
    const wethAddr = WETH_ADDRESSES[wethVault.chainId];
    const validator = new ERC4626Validator({
      vaults: [wethVault],
      lastUpdated: config.lastUpdated,
    });

    it(`WRAP: WETH deposit() — ${wethVault.protocol} on ${wethVault.network}`, () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      const tx = buildTx({
        to: wethAddr,
        data,
        value: '0xde0b6b3a7640000',
        chainId: wethVault.chainId,
      });
      const result = validator.validate(tx, TransactionType.WRAP, USER);
      expect(result.isValid).toBe(true);
    });

    it(`UNWRAP: WETH withdraw(amount) — ${wethVault.protocol} on ${wethVault.network}`, () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({
        to: wethAddr,
        data,
        value: '0x0',
        chainId: wethVault.chainId,
      });
      const result = validator.validate(tx, TransactionType.UNWRAP, USER);
      expect(result.isValid).toBe(true);
    });
  }
});

describe('cross-protocol isolation', () => {
  const protocols = Array.from(sampleByProtocol.entries());
  if (protocols.length >= 2) {
    const [, vaultA] = protocols[0];
    const [, vaultB] = protocols[1];

    const validatorA = new ERC4626Validator({
      vaults: [vaultA],
      lastUpdated: config.lastUpdated,
    });

    it(`deposit to ${vaultB.protocol} vault should be rejected by ${vaultA.protocol} validator`, () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('100', 18),
        USER,
      ]);
      const tx = buildTx({
        to: vaultB.address,
        data,
        value: '0x0',
        chainId: vaultB.chainId,
      });
      const result = validatorA.validate(tx, TransactionType.SUPPLY, USER);
      expect(result.isValid).toBe(false);
    });
  }
});
