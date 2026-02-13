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
const INPUT_TOKEN = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';  // USDC on Arbitrum
const WETH_ARBITRUM = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const WETH_VAULT_ADDRESS = '0xAABBCCDDEEFF00112233445566778899AABBCCDD';
const MALICIOUS_ADDRESS = '0x000000000000000000000000000000000000bad1';
const PAUSED_VAULT_ADDRESS = '0xDEAD000000000000000000000000000000000001';
const CHAIN_ID = 42161; // Arbitrum

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
      const result = validator.validate(tx, TransactionType.APPROVAL, USER_ADDRESS);
      expect(result.isValid).toBe(true);
    });

    it('should reject when spender is not a whitelisted vault', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        MALICIOUS_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.APPROVAL, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not a whitelisted vault');
    });

    it('should reject zero approval amount', () => {
      const data = erc20Iface.encodeFunctionData('approve', [VAULT_ADDRESS, 0]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.APPROVAL, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('zero');
    });

    it('should reject when ETH value is attached', () => {
      const data = erc20Iface.encodeFunctionData('approve', [
        VAULT_ADDRESS,
        ethers.parseUnits('1000', 6),
      ]);
      const tx = buildTx({ to: INPUT_TOKEN, data, value: '0xde0b6b3a7640000' });
      const result = validator.validate(tx, TransactionType.APPROVAL, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.APPROVAL, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.APPROVAL, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not a whitelisted vault');
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
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
      expect(result.isValid).toBe(true);
    });

    it('should validate a valid mint to whitelisted vault', () => {
      const data = erc4626Iface.encodeFunctionData('mint', [
        ethers.parseUnits('500', 18),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
      expect(result.isValid).toBe(true);
    });

    it('should reject vault not whitelisted', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not whitelisted');
    });

    it('should reject when receiver != user address', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        OTHER_ADDRESS, // receiver is someone else
      ]);
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Receiver address does not match');
    });

    it('should reject ETH value on non-WETH vault', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tx = buildTx({
        to: VAULT_ADDRESS,
        data,
        value: '0xde0b6b3a7640000', // 1 ETH
      });
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('should not send ETH to non-WETH vault');
    });

    it('should reject tampered calldata (receiver swapped after encoding)', () => {
      const data = erc4626Iface.encodeFunctionData('deposit', [
        ethers.parseUnits('1000', 6),
        USER_ADDRESS,
      ]);
      const tampered = data + 'cafebabe';
      const tx = buildTx({ to: VAULT_ADDRESS, data: tampered, value: '0x0' });
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not from user address');
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
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
      expect(result.isValid).toBe(true);
    });

    it('should validate a valid redeem — receiver=user, owner=user', () => {
      const data = erc4626Iface.encodeFunctionData(
        'redeem(uint256,address,address)',
        [ethers.parseUnits('500', 18), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
      expect(result.isValid).toBe(true);
    });

    it('should reject when receiver != user (funds redirected)', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), OTHER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Receiver address does not match');
    });

    it('should reject when owner != user', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, OTHER_ADDRESS],
      );
      const tx = buildTx({ to: VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Owner address does not match');
    });

    it('should reject vault not whitelisted', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('tampered');
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
      const result = validator.validate(tx, TransactionType.UNWRAP, USER_ADDRESS);
      expect(result.isValid).toBe(true);
    });

    it('should reject zero amount', () => {
      const data = wethIface.encodeFunctionData('withdraw', [0]);
      const tx = buildTx({ to: WETH_ARBITRUM, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.UNWRAP, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('UNWRAP amount is zero');
    });

    it('should reject wrong WETH address', () => {
      const data = wethIface.encodeFunctionData('withdraw', [
        ethers.parseEther('1'),
      ]);
      const tx = buildTx({ to: MALICIOUS_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.UNWRAP, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.UNWRAP, USER_ADDRESS);
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
      const result = validator.validate(tx, TransactionType.SUPPLY, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('paused');
    });

    it('should reject WITHDRAW from vault with canExit: false', () => {
      const data = erc4626Iface.encodeFunctionData(
        'withdraw(uint256,address,address)',
        [ethers.parseUnits('1000', 6), USER_ADDRESS, USER_ADDRESS],
      );
      const tx = buildTx({ to: PAUSED_VAULT_ADDRESS, data, value: '0x0' });
      const result = validator.validate(tx, TransactionType.WITHDRAW, USER_ADDRESS);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('disabled');
    });
  });
});