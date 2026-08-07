import { ethers } from 'ethers';
import { ERC4626Validator } from './erc4626.validator';
import { VaultConfiguration } from './types';
import { TransactionType } from '../../../types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_ADDRESS = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111';
const VAULT_ADDRESS = '0x78E3E051D32157AACD550fBB78458762d8f7edFF'; // Euler vault on Arbitrum
const INPUT_TOKEN = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // USDC on Arbitrum
const WETH_ARBITRUM = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const WETH_VAULT_ADDRESS = '0xAABBCCDDEEFF00112233445566778899AABBCCDD';
const MALICIOUS_ADDRESS = '0x000000000000000000000000000000000000bad1';
const PAUSED_VAULT_ADDRESS = '0xDEAD000000000000000000000000000000000001';
const ALLOCATOR_VAULT_ADDRESS = '0xa110ca7040000000000000000000000000000001';
const MORPHO_VAULT_ADDRESS = '0x00000000000000000000000000000000000face2';
const RECEIVER_ADDRESS = '0x2222222222222222222222222222222222222222';
const CHAIN_ID = 42161; // Arbitrum
const DEPOSIT_WEI = ethers.parseUnits('1000', 6); // 1000 USDC
const DECLARED = DEPOSIT_WEI.toString(); // '1000000000'

// ---------------------------------------------------------------------------
// ABI interfaces for building calldata
// ---------------------------------------------------------------------------

const erc20Iface = new ethers.Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const wethIface = new ethers.Interface([
  'function deposit() payable',
  'function withdraw(uint256 wad)',
]);

const erc4626Iface = new ethers.Interface([
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function mint(uint256 shares, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',
]);

// Sky/Spark Savings referral overloads
const erc4626ReferralIface = new ethers.Interface([
  'function deposit(uint256 assets, address receiver, uint16 referral) returns (uint256)',
  'function mint(uint256 shares, address receiver, uint16 referral) returns (uint256)',
]);

// ---------------------------------------------------------------------------
// Mock configuration
// ---------------------------------------------------------------------------

const mockConfig: VaultConfiguration = {
  vaults: [
    {
      address: VAULT_ADDRESS.toLowerCase(),
      chainId: CHAIN_ID,
      protocol: 'euler',
      yieldId: 'arbitrum-usdc-euler-vault',
      inputTokenAddress: INPUT_TOKEN.toLowerCase(),
      vaultTokenAddress: VAULT_ADDRESS.toLowerCase(),
      network: 'arbitrum',
      isWethVault: false,
      canEnter: true,
      canExit: true,
    },
    {
      address: WETH_VAULT_ADDRESS.toLowerCase(),
      chainId: CHAIN_ID,
      protocol: 'euler',
      yieldId: 'arbitrum-weth-euler-vault',
      inputTokenAddress: WETH_ARBITRUM.toLowerCase(),
      vaultTokenAddress: WETH_VAULT_ADDRESS.toLowerCase(),
      network: 'arbitrum',
      isWethVault: true,
      canEnter: true,
      canExit: true,
    },
    {
      address: PAUSED_VAULT_ADDRESS.toLowerCase(),
      chainId: CHAIN_ID,
      protocol: 'euler',
      yieldId: 'arbitrum-usdc-paused-vault',
      inputTokenAddress: INPUT_TOKEN.toLowerCase(),
      vaultTokenAddress: PAUSED_VAULT_ADDRESS.toLowerCase(),
      network: 'arbitrum',
      isWethVault: false,
      canEnter: false,
      canExit: false,
    },
    {
      address: MORPHO_VAULT_ADDRESS.toLowerCase(),
      chainId: CHAIN_ID,
      protocol: 'morpho',
      yieldId: 'arbitrum-usdc-morpho-oav-vault',
      inputTokenAddress: INPUT_TOKEN.toLowerCase(),
      vaultTokenAddress: MORPHO_VAULT_ADDRESS.toLowerCase(),
      network: 'arbitrum',
      isWethVault: false,
      canEnter: true,
      canExit: true,
      allocatorVaults: [ALLOCATOR_VAULT_ADDRESS],
    },
  ],
  lastUpdated: Date.now(),
};

// ---------------------------------------------------------------------------
// Helper: build a serialized transaction JSON string
// ---------------------------------------------------------------------------

function buildTx(overrides: Record<string, unknown> = {}): string {
  const base = {
    from: USER_ADDRESS,
    to: VAULT_ADDRESS,
    value: '0x0',
    data: '0x',
    nonce: 0,
    gasLimit: '0x30d40',
    maxFeePerGas: '0x6fc23ac00',
    maxPriorityFeePerGas: '0x3b9aca00',
    chainId: CHAIN_ID,
    type: 2,
  };
  return JSON.stringify({ ...base, ...overrides });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ERC4626Validator', () => {
  const validator = new ERC4626Validator(mockConfig);

  // =========================================================================
  // APPROVAL
  // =========================================================================
  describe('APPROVAL transactions', () => {
    it('should validate a valid approval — spender is whitelisted vault', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.parseUnits('1000', 6), // 1000 USDC
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject when spender is not a whitelisted vault', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        MALICIOUS_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not a whitelisted vault');
    });

    it('should accept zero approval amount (USDT reset pattern)', () => {
      const data = erc20Iface.encodeFunctionData('approve', [VAULT_ADDRESS, 0]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject when ETH value is attached', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0xde0b6b3a7640000' });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('should not send ETH');
    });

    it('should reject tampered calldata (modified spender after encoding)', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      // Tamper: append extra bytes
      const tampered = data + 'deadbeef';
      const tx = buildTx({ to: INPUT_TOKEN, data: tampered, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('tampered');
    });

    it('should reject wrong chain ID', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      // Chain 1 but vault is registered on 42161
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0', chainId: 1 });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not a whitelisted vault');
    });
    it('should reject when tx.to is not the vault input token', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      // tx.to is some random address, not the vault's inputTokenAddress (USDC)
      const tx = buildTx({ to: OTHER_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not match vault input token');
    });

    it('should accept max uint256 approval amount', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.MaxUint256,
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });
    describe('amount intent validation', () => {
      const approveTx = (amount: bigint) => {
        const data = erc20Iface.encodeFunctionData('approve', [
          VAULT_ADDRESS,
          amount,
        ]);
        return buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      };
      it('accepts approval exactly matching the declared amount', () => {
        const result = validator.validate(
          approveTx(DEPOSIT_WEI),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(true);
      });
      it('rejects approval one wei above the declared amount', () => {
        const result = validator.validate(
          approveTx(DEPOSIT_WEI + 1n),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects approval one wei below the declared amount', () => {
        const result = validator.validate(
          approveTx(DEPOSIT_WEI - 1n),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects grossly inflated approval', () => {
        const result = validator.validate(
          approveTx(DEPOSIT_WEI * 1000n),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects maxUint256 approval against a finite declared amount', () => {
        const result = validator.validate(
          approveTx(ethers.MaxUint256),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('accepts maxUint256 approval when declared amount is maxUint256 (useMaxAllowance)', () => {
        const result = validator.validate(
          approveTx(ethers.MaxUint256),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: ethers.MaxUint256.toString() },
        );
        expect(result.isValid).toBe(true);
      });
      it('accepts zero approval with a declared amount (USDT reset)', () => {
        const result = validator.validate(
          approveTx(0n),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(true);
      });
      it('skips amount enforcement when args.amount is absent (back-compat)', () => {
        const result = validator.validate(
          approveTx(DEPOSIT_WEI * 1000n),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { receiverAddress: RECEIVER_ADDRESS },
        );
        expect(result.isValid).toBe(true);
      });
      it('skips amount enforcement when args.amount is an empty string', () => {
        const result = validator.validate(
          approveTx(DEPOSIT_WEI),
          TransactionType.APPROVAL,
          USER_ADDRESS,
          { amount: '' },
        );
        expect(result.isValid).toBe(true);
      });
    });
  });

  // =========================================================================
  // WRAP
  // =========================================================================
  describe('WRAP transactions', () => {
    it('should validate a valid WETH deposit', () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      const tx = buildTx({
        to: WETH_ARBITRUM,
        data,
        value: '0xde0b6b3a7640000', // 1 ETH
      });
      const result = validator.validate(tx, TransactionType.WRAP, USER_ADDRESS);
      expect(result.isValid).toBe(true);
    });

    it('should reject wrong WETH address for chain', () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      const tx = buildTx({
        to: MALICIOUS_ADDRESS,
        data,
        value: '0xde0b6b3a7640000',
      });
      const result = validator.validate(tx, TransactionType.WRAP, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not to WETH contract');
    });

    it('should reject zero ETH value', () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      const tx = buildTx({ to: WETH_ARBITRUM, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.WRAP, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('must send ETH value');
    });

    it('should reject non-deposit function selector', () => {
      // Use withdraw selector instead of deposit
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({
        to: WETH_ARBITRUM,
        data,
        value: '0xde0b6b3a7640000',
      });
      const result = validator.validate(tx, TransactionType.WRAP, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Invalid method for wrapping');
    });

    it('should reject wrong chain ID', () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      // Chain 999 has no WETH configured
      const tx = buildTx({
        to: WETH_ARBITRUM,
        data,
        value: '0xde0b6b3a7640000',
        chainId: 999,
      });
      const result = validator.validate(tx, TransactionType.WRAP, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('WETH address not configured');
    });
    describe('amount intent validation', () => {
      const ONE_ETH = ethers.parseEther('1'); // 10^18
      const wrapTx = (value: bigint) =>
        buildTx({
          to: WETH_ARBITRUM,
          data: wethIface.encodeFunctionData('deposit', []),
          value: '0x' + value.toString(16),
        });
      it('accepts wrap value exactly matching the declared amount', () => {
        const result = validator.validate(
          wrapTx(ONE_ETH),
          TransactionType.WRAP,
          USER_ADDRESS,
          { amount: ONE_ETH.toString() },
        );
        expect(result.isValid).toBe(true);
      });
      it('rejects wrap value above the declared amount', () => {
        const result = validator.validate(
          wrapTx(ONE_ETH * 2n),
          TransactionType.WRAP,
          USER_ADDRESS,
          { amount: ONE_ETH.toString() },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'WRAP amount does not match declared intent',
        );
      });
      it('rejects wrap value below the declared amount', () => {
        const result = validator.validate(
          wrapTx(ONE_ETH / 2n),
          TransactionType.WRAP,
          USER_ADDRESS,
          { amount: ONE_ETH.toString() },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'WRAP amount does not match declared intent',
        );
      });
      it('skips amount enforcement when args.amount is absent (back-compat)', () => {
        const result = validator.validate(
          wrapTx(ONE_ETH * 5n),
          TransactionType.WRAP,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(true);
      });
    });
  });

  // =========================================================================
  // SUPPLY
  // =========================================================================
  describe('SUPPLY transactions', () => {
    it('should validate a valid deposit to whitelisted vault', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate a valid mint to whitelisted vault', () => {
      const data = erc4626Iface.encodeFunctionData('mint', [
        ethers.parseUnits('500', 18),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject vault not whitelisted', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('should reject when receiver != user address', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        OTHER_ADDRESS, // receiver is someone else
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Receiver address does not match');
    });

    it('should reject ETH value on supply', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({
        to: VAULT_ADDRESS,
        data,
        value: '0xde0b6b3a7640000', // 1 ETH
      });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('should not send ETH');
    });

    it('should reject tampered calldata (receiver swapped after encoding)', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tampered = data + 'cafebabe';
      const tx = buildTx({ to: VAULT_ADDRESS, data: tampered, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('tampered');
    });

    it('should reject tx.to swapped to malicious vault (core attack vector)', () => {
      // Calldata looks valid (receiver = user) but tx.to is not whitelisted
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({
        to: '0x000000000000000000000000000000000000dEaD',
        data,
        value: '0x0',
      });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('should reject wrong chain ID for vault', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      // Vault registered on 42161 but tx says chain 1
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0', chainId: 1 });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('should reject when from != user address', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({
        to: VAULT_ADDRESS,
        data,
        value: '0x0',
        from: OTHER_ADDRESS, // not the user
      });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not from user address');
    });
    it('should reject unknown function selector (e.g. transfer)', () => {
      const transferIface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);
      const data = transferIface.encodeFunctionData('transfer', [
        OTHER_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject ETH value on WETH vault (wrapping is a separate step)', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseEther('1'),
        USER_ADDRESS,
      ]);
      const tx = buildTx({
        to: WETH_VAULT_ADDRESS,
        data,
        value: '0xde0b6b3a7640000',
      });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('should not send ETH');
    });

    it('should reject zero-amount deposit', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        0,
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('zero');
    });
    describe('amount intent validation', () => {
      const depositTx = (assets: bigint) => {
        const data = erc4626Iface.encodeFunctionData('deposit', [
          assets,
          USER_ADDRESS,
        ]);
        return buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      };
      const mintTx = (shares: bigint) => {
        const data = erc4626Iface.encodeFunctionData('mint', [
          shares,
          USER_ADDRESS,
        ]);
        return buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      };
      it('accepts deposit exactly matching the declared amount', () => {
        const result = validator.validate(
          depositTx(DEPOSIT_WEI),
          TransactionType.SUPPLY,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(true);
      });
      it('rejects deposit one wei above the declared amount', () => {
        const result = validator.validate(
          depositTx(DEPOSIT_WEI + 1n),
          TransactionType.SUPPLY,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects deposit one wei below the declared amount', () => {
        const result = validator.validate(
          depositTx(DEPOSIT_WEI - 1n),
          TransactionType.SUPPLY,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects grossly inflated deposit', () => {
        const result = validator.validate(
          depositTx(DEPOSIT_WEI * 1_000_000n),
          TransactionType.SUPPLY,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects mint when a declared amount is present (fail-closed, no deposit→mint bypass)', () => {
        const result = validator.validate(
          mintTx(DEPOSIT_WEI),
          TransactionType.SUPPLY,
          USER_ADDRESS,
          { amount: DECLARED },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Cannot verify mint');
      });
      it('still accepts mint without a declared amount (back-compat)', () => {
        const result = validator.validate(
          mintTx(DEPOSIT_WEI),
          TransactionType.SUPPLY,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(true);
      });
      it('skips amount enforcement when args.amount is absent (back-compat)', () => {
        const result = validator.validate(
          depositTx(DEPOSIT_WEI * 7n),
          TransactionType.SUPPLY,
          USER_ADDRESS,
          { receiverAddress: RECEIVER_ADDRESS },
        );
        // receiver in calldata is USER_ADDRESS but declared receiver differs → this
        // exercises that amount skip doesn't short-circuit the receiver check
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Receiver address');
      });
      it('enforces declared amount together with the receiver check (both must pass)', () => {
        const data = erc4626Iface.encodeFunctionData('deposit', [
          DEPOSIT_WEI,
          RECEIVER_ADDRESS,
        ]);
        const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
        const result = validator.validate(
          tx,
          TransactionType.SUPPLY,
          USER_ADDRESS,
          {
            amount: DECLARED,
            receiverAddress: RECEIVER_ADDRESS,
          },
        );
        expect(result.isValid).toBe(true);
      });
      it('blocks a human-readable declared amount ("0.01") with an explicit reason', () => {
        const result = validator.validate(
          depositTx(DEPOSIT_WEI),
          TransactionType.SUPPLY,
          USER_ADDRESS,
          { amount: '0.01', decimals: 6 },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'Declared amount must be a base-unit integer string (wei)',
        );
      });
      it('blocks a non-numeric declared amount before any type-specific validation', () => {
        const result = validator.validate(
          depositTx(DEPOSIT_WEI),
          TransactionType.APPROVAL, // guard fires pre-routing, type is irrelevant
          USER_ADDRESS,
          { amount: 'abc' },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('base-unit integer string');
      });
    });
    // -----------------------------------------------------------------------
    // Sky/Spark referral overloads — deposit/mint(..., uint16 referral)
    // -----------------------------------------------------------------------
    describe('referral overloads (uint16)', () => {
      it.each([
        [3008, 'Sky Ethereum ref code'],
        [200, 'Spark L2 ref code'],
        [0, 'zero referral'],
        [65535, 'uint16 max'],
      ])(
        'should validate a valid 3-arg deposit with referral %i (%s) — accept-any',
        (referral) => {
          const data = erc4626ReferralIface.encodeFunctionData('deposit', [
            DEPOSIT_WEI,
            USER_ADDRESS,
            referral,
          ]);
          const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
          const result = validator.validate(
            tx,
            TransactionType.SUPPLY,
            USER_ADDRESS,
          );
          expect(result.isValid).toBe(true);
        },
      );
      it('should validate a valid 3-arg mint (no declared amount)', () => {
        const data = erc4626ReferralIface.encodeFunctionData('mint', [
          ethers.parseUnits('500', 18),
          USER_ADDRESS,
          3008,
        ]);
        const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
        const result = validator.validate(
          tx,
          TransactionType.SUPPLY,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(true);
      });
      it('should reject 3-arg deposit when receiver != user', () => {
        const data = erc4626ReferralIface.encodeFunctionData('deposit', [
          DEPOSIT_WEI,
          MALICIOUS_ADDRESS, // receiver redirected
          3008,
        ]);
        const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
        const result = validator.validate(
          tx,
          TransactionType.SUPPLY,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Receiver address does not match');
      });
      it('should reject tampered 3-arg calldata (appended bytes)', () => {
        // Also regression-covers the fragment-based tamper re-encode in
        // BaseEVMValidator (name-based lookup throws on overloaded ABIs).
        const data = erc4626ReferralIface.encodeFunctionData('deposit', [
          DEPOSIT_WEI,
          USER_ADDRESS,
          3008,
        ]);
        const tampered = data + 'deadbeef';
        const tx = buildTx({ to: VAULT_ADDRESS, data: tampered, value: '0x0' });
        const result = validator.validate(
          tx,
          TransactionType.SUPPLY,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('tampered');
      });
      it('should reject zero-amount 3-arg deposit', () => {
        const data = erc4626ReferralIface.encodeFunctionData('deposit', [
          0,
          USER_ADDRESS,
          3008,
        ]);
        const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
        const result = validator.validate(
          tx,
          TransactionType.SUPPLY,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('zero');
      });
      it('should reject 3-arg deposit to non-whitelisted vault', () => {
        const data = erc4626ReferralIface.encodeFunctionData('deposit', [
          DEPOSIT_WEI,
          USER_ADDRESS,
          3008,
        ]);
        const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
        const result = validator.validate(
          tx,
          TransactionType.SUPPLY,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('not whitelisted');
      });
    });
  });

  // =========================================================================
  // WITHDRAW
  // =========================================================================
  describe('WITHDRAW transactions', () => {
    it('should validate a valid withdraw — receiver=user, owner=user', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate a valid redeem — receiver=user, owner=user', () => {
      const data = erc4626Iface.encodeFunctionData(
        'redeem(uint256,address,address)',
        [ethers.parseUnits('500', 18), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject when receiver != user (funds redirected)', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), OTHER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Receiver address does not match');
    });

    it('should reject when owner != user', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, OTHER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Owner address does not match');
    });

    it('should reject vault not whitelisted', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('should reject ETH value attached', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({
        to: VAULT_ADDRESS,
        data,
        value: '0xde0b6b3a7640000',
      });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('should not send ETH');
    });

    it('should reject tampered calldata', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tampered = data + '12345678';
      const tx = buildTx({ to: VAULT_ADDRESS, data: tampered, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('tampered');
    });
    it('should reject unknown function selector (e.g. transfer)', () => {
      const transferIface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);
      const data = transferIface.encodeFunctionData('transfer', [
        OTHER_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
    });

    it('should reject zero-amount withdraw', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [0, USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('zero');
    });

    describe('amount intent validation', () => {
      // Asset wei — reuse enter-side scale (1000 USDC @ 6 decimals).
      const WITHDRAW_WEI = DEPOSIT_WEI; // 1000000000n
      const DECLARED_ASSETS = DECLARED; // '1000000000'
      // Share wei — small integers so margin "10" (no feeConfig / no vault decimals) is easy to hit.
      const SHARE_WEI = 1000n;
      const DECLARED_SHARES = '1000';
      const withdrawTx = (assets: bigint) => {
        const data = erc4626Iface.encodeFunctionData(
          'withdraw(uint256,address,address)',
          [assets, USER_ADDRESS, USER_ADDRESS],
        );
        return buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      };
      const redeemTx = (shares: bigint) => {
        const data = erc4626Iface.encodeFunctionData(
          'redeem(uint256,address,address)',
          [shares, USER_ADDRESS, USER_ADDRESS],
        );
        return buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      };
      // --- withdraw: exact match vs args.amount ---
      it('accepts withdraw exactly matching the declared amount', () => {
        const result = validator.validate(
          withdrawTx(WITHDRAW_WEI),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { amount: DECLARED_ASSETS },
        );
        expect(result.isValid).toBe(true);
      });
      it('rejects withdraw one wei above the declared amount', () => {
        const result = validator.validate(
          withdrawTx(WITHDRAW_WEI + 1n),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { amount: DECLARED_ASSETS },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects withdraw one wei below the declared amount', () => {
        const result = validator.validate(
          withdrawTx(WITHDRAW_WEI - 1n),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { amount: DECLARED_ASSETS },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('skips amount enforcement on withdraw when args.amount is absent (back-compat)', () => {
        const result = validator.validate(
          withdrawTx(WITHDRAW_WEI * 7n),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(true);
      });
      it('rejects withdraw when only shareAmount is declared (fail-closed, no redeem→withdraw bypass)', () => {
        const result = validator.validate(
          withdrawTx(WITHDRAW_WEI),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { shareAmount: DECLARED_SHARES },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'Cannot verify withdraw (asset-denominated) against declared shareAmount',
        );
      });
      // --- redeem: within-margin match vs args.shareAmount ---
      // mockConfig vault has no decimals / no feeConfigurationId → margin "10"
      it('accepts redeem exactly matching the declared shareAmount', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { shareAmount: DECLARED_SHARES },
        );
        expect(result.isValid).toBe(true);
      });
      it('accepts redeem within margin above declared shareAmount (snap-up, Δ=5 ≤ 10)', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI + 5n),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { shareAmount: DECLARED_SHARES },
        );
        expect(result.isValid).toBe(true);
      });
      it('accepts redeem within margin below declared shareAmount (snap-down, Δ=5 ≤ 10)', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI - 5n),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { shareAmount: DECLARED_SHARES },
        );
        expect(result.isValid).toBe(true);
      });
      it('rejects redeem outside margin (Δ=11 > 10)', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI + 11n),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { shareAmount: DECLARED_SHARES },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('does not match declared intent');
      });
      it('rejects redeem when only amount is declared (fail-closed, no withdraw→redeem bypass)', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { amount: DECLARED_ASSETS },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'Cannot verify redeem (share-denominated) against declared asset amount',
        );
      });
      it('skips shareAmount enforcement on redeem when args.shareAmount is absent (back-compat)', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI * 7n),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
        );
        expect(result.isValid).toBe(true);
      });
      // --- cross-cutting guards (fire in validate() before routing) ---
      it('rejects when both amount and shareAmount are declared', () => {
        const result = validator.validate(
          withdrawTx(WITHDRAW_WEI),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { amount: DECLARED_ASSETS, shareAmount: DECLARED_SHARES },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'Cannot declare both amount and shareAmount',
        );
      });
      it('blocks a human-readable declared amount ("0.01") with an explicit reason', () => {
        const result = validator.validate(
          withdrawTx(WITHDRAW_WEI),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { amount: '0.01', decimals: 6 },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'Declared amount must be a base-unit integer string (wei)',
        );
      });
      it('blocks a human-readable declared shareAmount ("0.01") with an explicit reason', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI),
          TransactionType.WITHDRAW,
          USER_ADDRESS,
          { shareAmount: '0.01' },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'Declared shareAmount must be a base-unit integer string (share wei)',
        );
      });
      it('blocks a non-numeric declared shareAmount before any type-specific validation', () => {
        const result = validator.validate(
          redeemTx(SHARE_WEI),
          TransactionType.APPROVAL, // guard fires pre-routing; type is irrelevant
          USER_ADDRESS,
          { shareAmount: 'abc' },
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('base-unit integer string');
      });
    });
  });

  // =========================================================================
  // receiverAddress override (args.receiverAddress)
  // =========================================================================
  describe('receiverAddress override via args', () => {
    // ---- SUPPLY ----
    it('SUPPLY: should accept when args.receiverAddress matches calldata receiver', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        RECEIVER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
        { receiverAddress: RECEIVER_ADDRESS },
      );
      expect(result.isValid).toBe(true);
    });

    it('SUPPLY: should block when args.receiverAddress does NOT match calldata receiver', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        MALICIOUS_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
        { receiverAddress: RECEIVER_ADDRESS },
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not match expected address');
    });

    it('SUPPLY: without args.receiverAddress, receiver != user is blocked (default behavior)', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        OTHER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not match expected address');
    });

    it('SUPPLY: without args.receiverAddress, receiver == user is safe (default behavior)', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    // ---- WITHDRAW ----
    it('WITHDRAW: should accept when args.receiverAddress matches calldata receiver', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), RECEIVER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
        { receiverAddress: RECEIVER_ADDRESS },
      );
      expect(result.isValid).toBe(true);
    });

    it('WITHDRAW: should block when args.receiverAddress does NOT match calldata receiver', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), MALICIOUS_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
        { receiverAddress: RECEIVER_ADDRESS },
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not match expected address');
    });
  });

  // =========================================================================
  // UNWRAP
  // =========================================================================
  describe('UNWRAP transactions', () => {
    it('should validate a valid WETH withdraw', () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({ to: WETH_ARBITRUM, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.UNWRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject zero amount', () => {
      const data = wethIface.encodeFunctionData('withdraw', [0]);
      const tx = buildTx({ to: WETH_ARBITRUM, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.UNWRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('UNWRAP amount is zero');
    });

    it('should reject wrong WETH address', () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.UNWRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not to WETH contract');
    });

    it('should reject ETH value attached', () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({
        to: WETH_ARBITRUM,
        data,
        value: '0xde0b6b3a7640000',
      });
      const result = validator.validate(
        tx,
        TransactionType.UNWRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('should not send ETH');
    });
  });

  // =========================================================================
  // canEnter / canExit
  // =========================================================================
  describe('canEnter / canExit flag checks', () => {
    it('should reject SUPPLY to vault with canEnter: false', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: PAUSED_VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('paused');
    });

    it('should reject WITHDRAW from vault with canExit: false', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: PAUSED_VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('disabled');
    });
  });
  // =========================================================================
  // Shared path edge cases
  // =========================================================================
  describe('shared validation path edge cases', () => {
    it('should reject invalid JSON input', () => {
      const result = validator.validate(
        'not-valid-json',
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Failed to decode');
    });

    it('should reject when from field is missing', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      // Build raw JSON without using buildTx, so we can omit `from`
      const txObj = {
        to: VAULT_ADDRESS,
        value: '0x0',
        data,
        nonce: 0,
        gasLimit: '0x30d40',
        maxFeePerGas: '0x6fc23ac00',
        maxPriorityFeePerGas: '0x3b9aca00',
        chainId: CHAIN_ID,
        type: 2,
      };
      const result = validator.validate(
        JSON.stringify(txObj),
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not from user address');
    });

    it('should reject when chainId is missing', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const txObj = {
        from: USER_ADDRESS,
        to: VAULT_ADDRESS,
        value: '0x0',
        data,
        type: 2,
        // no chainId
      };
      const result = validator.validate(
        JSON.stringify(txObj),
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Failed to decode');
    });

    it('should reject when tx.to is null', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: null, data, value: '0x0' });
      const result = validator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('no destination address');
    });
  });
  // =========================================================================
  // Shield tx auto-detection//routing simulation
  // =========================================================================
  describe('auto-detection (simulating Shield routing)', () => {
    const allTypes = validator.getSupportedTransactionTypes();

    it('deposit calldata should match exactly one type: SUPPLY', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });

      const matches = allTypes.filter(
        (type) => validator.validate(tx, type, USER_ADDRESS).isValid,
      );
      expect(matches).toEqual([TransactionType.SUPPLY]);
    });

    it('withdraw calldata should match exactly one type: WITHDRAW', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });

      const matches = allTypes.filter(
        (type) => validator.validate(tx, type, USER_ADDRESS).isValid,
      );
      expect(matches).toEqual([TransactionType.WITHDRAW]);
    });

    it('WETH deposit calldata should match exactly one type: WRAP', () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      const tx = buildTx({
        to: WETH_ARBITRUM,
        data,
        value: '0xde0b6b3a7640000',
      });

      const matches = allTypes.filter(
        (type) => validator.validate(tx, type, USER_ADDRESS).isValid,
      );
      expect(matches).toEqual([TransactionType.WRAP]);
    });

    it('approval calldata should match exactly one type: APPROVAL', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });

      const matches = allTypes.filter(
        (type) => validator.validate(tx, type, USER_ADDRESS).isValid,
      );
      expect(matches).toEqual([TransactionType.APPROVAL]);
    });

    it('WETH withdraw calldata should match exactly one type: UNWRAP', () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({ to: WETH_ARBITRUM, data, value: '0x0' });

      const matches = allTypes.filter(
        (type) => validator.validate(tx, type, USER_ADDRESS).isValid,
      );
      expect(matches).toEqual([TransactionType.UNWRAP]);
    });
  });

  // =========================================================================
  // WETH vault gating (per-vault instance behavior)
  // =========================================================================
  describe('WETH vault gating', () => {
    // Non-WETH single-vault instance (simulates per-yield registration)
    const nonWethValidator = new ERC4626Validator({
      vaults: [
        {
          address: VAULT_ADDRESS.toLowerCase(),
          chainId: CHAIN_ID,
          protocol: 'euler',
          yieldId: 'arbitrum-usdc-euler-vault',
          inputTokenAddress: INPUT_TOKEN.toLowerCase(),
          vaultTokenAddress: VAULT_ADDRESS.toLowerCase(),
          network: 'arbitrum',
          isWethVault: false,
          canEnter: true,
          canExit: true,
        },
      ],
      lastUpdated: Date.now(),
    });

    // WETH single-vault instance
    const wethValidator = new ERC4626Validator({
      vaults: [
        {
          address: WETH_VAULT_ADDRESS.toLowerCase(),
          chainId: CHAIN_ID,
          protocol: 'euler',
          yieldId: 'arbitrum-weth-euler-vault',
          inputTokenAddress: WETH_ARBITRUM.toLowerCase(),
          vaultTokenAddress: WETH_VAULT_ADDRESS.toLowerCase(),
          network: 'arbitrum',
          isWethVault: true,
          canEnter: true,
          canExit: true,
        },
      ],
      lastUpdated: Date.now(),
    });

    it('should reject WRAP when validator has no WETH vaults', () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      const tx = buildTx({
        to: WETH_ARBITRUM,
        data,
        value: '0xde0b6b3a7640000',
      });
      const result = nonWethValidator.validate(
        tx,
        TransactionType.WRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No WETH vaults registered');
    });

    it('should reject UNWRAP when validator has no WETH vaults', () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({ to: WETH_ARBITRUM, data, value: '0x0' });
      const result = nonWethValidator.validate(
        tx,
        TransactionType.UNWRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No WETH vaults registered');
    });

    it('should accept WRAP when validator has a WETH vault', () => {
      const data = wethIface.encodeFunctionData('deposit', []);
      const tx = buildTx({
        to: WETH_ARBITRUM,
        data,
        value: '0xde0b6b3a7640000',
      });
      const result = wethValidator.validate(
        tx,
        TransactionType.WRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should accept UNWRAP when validator has a WETH vault', () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({ to: WETH_ARBITRUM, data, value: '0x0' });
      const result = wethValidator.validate(
        tx,
        TransactionType.UNWRAP,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });
  });
  // =========================================================================
  // Allocator vault (OAV) support
  // =========================================================================
  describe('allocator vault (OAV) transactions', () => {
    const oavValidator = new ERC4626Validator({
      vaults: [
        {
          address: VAULT_ADDRESS.toLowerCase(),
          chainId: CHAIN_ID,
          protocol: 'morpho',
          yieldId: 'arbitrum-usdc-morpho-oav-vault',
          inputTokenAddress: INPUT_TOKEN.toLowerCase(),
          vaultTokenAddress: VAULT_ADDRESS.toLowerCase(),
          network: 'arbitrum',
          isWethVault: false,
          canEnter: true,
          canExit: true,
          allocatorVaults: [ALLOCATOR_VAULT_ADDRESS],
        },
      ],
      lastUpdated: Date.now(),
    });

    it('should validate SUPPLY (deposit) to allocator vault address', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: ALLOCATOR_VAULT_ADDRESS, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate SUPPLY (mint) to allocator vault address', () => {
      const data = erc4626Iface.encodeFunctionData('mint', [
        ethers.parseUnits('500', 18),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: ALLOCATOR_VAULT_ADDRESS, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate WITHDRAW (redeem) from allocator vault address', () => {
      const data = erc4626Iface.encodeFunctionData(
        'redeem(uint256,address,address)',
        [ethers.parseUnits('500', 18), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: ALLOCATOR_VAULT_ADDRESS, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate WITHDRAW (withdraw) from allocator vault address', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: ALLOCATOR_VAULT_ADDRESS, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate APPROVAL with allocator vault as spender', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        ALLOCATOR_VAULT_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.APPROVAL,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should still validate SUPPLY to the base vault address', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject SUPPLY to unknown address (not base vault or allocator)', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('should reject WITHDRAW from unknown address (not base vault or allocator)', () => {
      const data = erc4626Iface.encodeFunctionData(
        'redeem(uint256,address,address)',
        [ethers.parseUnits('500', 18), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = oavValidator.validate(
        tx,
        TransactionType.WITHDRAW,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('allocator vault deposit should match exactly one type: SUPPLY', () => {
      const allTypes = oavValidator.getSupportedTransactionTypes();
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: ALLOCATOR_VAULT_ADDRESS, data, value: '0x0' });

      const matches = allTypes.filter(
        (type) => oavValidator.validate(tx, type, USER_ADDRESS).isValid,
      );
      expect(matches).toEqual([TransactionType.SUPPLY]);
    });

    it('should work with no allocator vaults configured (field omitted)', () => {
      const plainValidator = new ERC4626Validator({
        vaults: [
          {
            address: VAULT_ADDRESS.toLowerCase(),
            chainId: CHAIN_ID,
            protocol: 'euler',
            yieldId: 'arbitrum-usdc-euler-vault',
            inputTokenAddress: INPUT_TOKEN.toLowerCase(),
            vaultTokenAddress: VAULT_ADDRESS.toLowerCase(),
            network: 'arbitrum',
            isWethVault: false,
            canEnter: true,
            canExit: true,
          },
        ],
        lastUpdated: Date.now(),
      });

      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = plainValidator.validate(
        tx,
        TransactionType.SUPPLY,
        USER_ADDRESS,
      );
      expect(result.isValid).toBe(true);
    });
  });
});
