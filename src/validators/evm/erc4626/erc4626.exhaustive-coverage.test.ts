import { ethers } from 'ethers';
import { ERC4626Validator } from './erc4626.validator';
import { loadEmbeddedRegistry } from './vault-config';
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
const allowedVaults = config.vaults.filter((v) =>
  GENERIC_ERC4626_PROTOCOLS.has(v.protocol),
);

describe(`ERC4626 exhaustive coverage — all ${allowedVaults.length} allowed vaults`, () => {
  it('should have allowed vaults to test', () => {
    expect(allowedVaults.length).toBeGreaterThan(0);
  });

  for (const vault of allowedVaults) {
    const validator = new ERC4626Validator({
      vaults: [vault],
      lastUpdated: config.lastUpdated,
    });
    const active = vault.canEnter !== false && vault.canExit !== false;
    const label = `${vault.protocol}/${vault.network} — ${vault.yieldId}`;

    if (active) {
      it(`APPROVAL — ${label}`, () => {
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
        expect(
          validator.validate(tx, TransactionType.APPROVAL, USER).isValid,
        ).toBe(true);
      });

      it(`SUPPLY — ${label}`, () => {
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
        expect(
          validator.validate(tx, TransactionType.SUPPLY, USER).isValid,
        ).toBe(true);
      });

      it(`WITHDRAW — ${label}`, () => {
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
        expect(
          validator.validate(tx, TransactionType.WITHDRAW, USER).isValid,
        ).toBe(true);
      });

      if (vault.isWethVault && WETH_ADDRESSES[vault.chainId]) {
        const wethAddr = WETH_ADDRESSES[vault.chainId];

        it(`WRAP — ${label}`, () => {
          const data = wethIface.encodeFunctionData('deposit', []);
          const tx = buildTx({
            to: wethAddr,
            data,
            value: '0xde0b6b3a7640000',
            chainId: vault.chainId,
          });
          expect(
            validator.validate(tx, TransactionType.WRAP, USER).isValid,
          ).toBe(true);
        });

        it(`UNWRAP — ${label}`, () => {
          const data = wethIface.encodeFunctionData('withdraw', [
            ethers.parseEther('1'),
          ]);
          const tx = buildTx({
            to: wethAddr,
            data,
            value: '0x0',
            chainId: vault.chainId,
          });
          expect(
            validator.validate(tx, TransactionType.UNWRAP, USER).isValid,
          ).toBe(true);
        });
      }
    } else {
      if (vault.canEnter === false) {
        it(`SUPPLY blocked (paused) — ${label}`, () => {
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
          expect(
            validator.validate(tx, TransactionType.SUPPLY, USER).isValid,
          ).toBe(false);
        });
      }

      if (vault.canExit === false) {
        it(`WITHDRAW blocked (disabled) — ${label}`, () => {
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
          expect(
            validator.validate(tx, TransactionType.WITHDRAW, USER).isValid,
          ).toBe(false);
        });
      }
    }
  }
});
