import { handleJsonRequest } from './handler';

describe('handleJsonRequest', () => {
  // Helper to parse response
  const call = (req: object | string) => {
    const input = typeof req === 'string' ? req : JSON.stringify(req);
    return JSON.parse(handleJsonRequest(input));
  };

  describe('validate operation', () => {
    // Use the same test data as shield.test.ts
    const userAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';
    const referralAddress = '0x371240E80Bf84eC2bA8b55aE2fD0B467b16Db2be';

    const validLidoStakeTx = {
      to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', // Lido stETH
      from: userAddress,
      value: '0xde0b6b3a7640000', // 1 ETH
      data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'), // submit(referral)
      chainId: 1,
    };

    const validLidoUnstakeTx = {
      to: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1', // Lido withdrawal queue
      from: userAddress,
      value: '0x0',
      data:
        '0xd6681042' + // requestWithdrawals function selector
        '0000000000000000000000000000000000000000000000000000000000000040' + // amounts offset
        '000000000000000000000000' +
        userAddress.slice(2) + // owner
        '0000000000000000000000000000000000000000000000000000000000000001' + // array length
        '0000000000000000000000000000000000000000000000000de0b6b3a7640000', // amount
      chainId: 1,
    };

    it('should validate a correct Lido stake transaction', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(validLidoStakeTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(true);
      expect(response.result.detectedType).toBe('STAKE');
      expect(response.meta.requestHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should validate a correct Lido unstake transaction', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(validLidoUnstakeTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(true);
      expect(response.result.detectedType).toBe('UNSTAKE');
    });

    it('should reject transaction with wrong referral address', () => {
      const invalidReferralTx = {
        ...validLidoStakeTx,
        data:
          '0xa1903eab' +
          '0000000000000000000000000000000000000000000000000000000000000000', // wrong referral
      };

      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(invalidReferralTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true); // Request succeeded
      expect(response.result.isValid).toBe(false); // But validation failed
      expect(response.result.reason).toContain(
        'No matching operation pattern found',
      );
    });

    it('should reject transaction with wrong contract address', () => {
      const wrongContractTx = {
        ...validLidoStakeTx,
        to: '0x0000000000000000000000000000000000000000', // wrong contract
      };

      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(wrongContractTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(false);
    });

    it('should reject transaction with wrong from address', () => {
      const wrongFromTx = {
        ...validLidoStakeTx,
        from: '0x0000000000000000000000000000000000000001', // different from userAddress
      };

      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(wrongFromTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(false);
    });

    it('should return error for missing yieldId', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        unsignedTransaction: JSON.stringify(validLidoStakeTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should return error for missing unsignedTransaction', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        userAddress: userAddress,
      });

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('MISSING_REQUIRED_FIELD');
    });

    it('should return error for missing userAddress', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(validLidoStakeTx),
      });

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('MISSING_REQUIRED_FIELD');
    });
  });

  describe('optional parameters: args and context', () => {
    const userAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';
    const referralAddress = '0x371240E80Bf84eC2bA8b55aE2fD0B467b16Db2be';

    const validLidoStakeTx = {
      to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      from: userAddress,
      value: '0xde0b6b3a7640000',
      data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
      chainId: 1,
    };

    it('should forward args parameter to Shield validator', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(validLidoStakeTx),
        userAddress: userAddress,
        args: {
          amount: '1000000000000000000',
        },
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(true);
    });

    it('should forward context parameter to Shield validator', () => {
    const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(validLidoStakeTx),
        userAddress: userAddress,
        context: {
        feeConfiguration: [
            {
            depositFeeBps: 100,
            feeRecipientAddress: '0x1234567890123456789012345678901234567890',
            },
        ],
        },
    });

    expect(response.ok).toBe(true);
    expect(response.result.isValid).toBe(true);
    });

    it('should forward both args and context parameters together', () => {
    const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(validLidoStakeTx),
        userAddress: userAddress,
        args: {
        amount: '1000000000000000000',
        },
        context: {
        feeConfiguration: [
            {
            depositFeeBps: 50,
            feeRecipientAddress: '0x1234567890123456789012345678901234567890',
            },
        ],
        },
    });

    expect(response.ok).toBe(true);
    expect(response.result.isValid).toBe(true);
    });
  });

  describe('isSupported operation', () => {
    it('should return supported: true for known yield', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'isSupported',
        yieldId: 'ethereum-eth-lido-staking',
      });

      expect(response.ok).toBe(true);
      expect(response.result.supported).toBe(true);
    });

    it('should return supported: false for unknown yield', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'isSupported',
        yieldId: 'unknown-yield-xyz',
      });

      expect(response.ok).toBe(true);
      expect(response.result.supported).toBe(false);
    });
  });

  describe('getSupportedYieldIds operation', () => {
    it('should return list of all supported yields', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'getSupportedYieldIds',
      });

      expect(response.ok).toBe(true);
      expect(response.result.yieldIds).toContain('ethereum-eth-lido-staking');
      expect(response.result.yieldIds).toContain(
        'solana-sol-native-multivalidator-staking',
      );
    });
  });

  describe('security: schema validation', () => {
    it('should reject invalid JSON', () => {
      const response = call('{ invalid json }');

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('PARSE_ERROR');
    });

    it('should reject unknown apiVersion', () => {
      const response = call({
        apiVersion: '2.0',
        operation: 'getSupportedYieldIds',
      });

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('SCHEMA_VALIDATION_ERROR');
    });

    it('should reject unknown operation', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'deleteEverything',
      });

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('SCHEMA_VALIDATION_ERROR');
    });

    it('should reject unknown properties (no injection)', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'getSupportedYieldIds',
        __proto__: { admin: true }, // Attempted prototype pollution
        maliciousField: 'value',
      });

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('SCHEMA_VALIDATION_ERROR');
    });

    it('should reject oversized yieldId', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'isSupported',
        yieldId: 'x'.repeat(300), // Exceeds 256 char limit
      });

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('SCHEMA_VALIDATION_ERROR');
    });
  });

  describe('security: tampering detection', () => {
    const userAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';
    const referralAddress = '0x371240E80Bf84eC2bA8b55aE2fD0B467b16Db2be';

    const validLidoStakeTx = {
      to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      from: userAddress,
      value: '0xde0b6b3a7640000',
      data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
      chainId: 1,
    };

    it('should reject transaction with appended data', () => {
      const tamperedTx = {
        ...validLidoStakeTx,
        data: validLidoStakeTx.data + 'deadbeef',
      };

      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(tamperedTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(false);
    });

    it('should reject transaction with modified function selector', () => {
      const tamperedTx = {
        ...validLidoStakeTx,
        data: '0xdeadbeef' + validLidoStakeTx.data.slice(10),
      };

      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(tamperedTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(false);
    });

    it('should reject truncated transaction data', () => {
      const truncatedTx = {
        ...validLidoStakeTx,
        data: validLidoStakeTx.data.slice(0, -8), // Remove last 4 bytes
      };

      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: JSON.stringify(truncatedTx),
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(false);
    });

    it('should reject malformed JSON in unsignedTransaction', () => {
      const response = call({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: '{ invalid json }',
        userAddress: userAddress,
      });

      expect(response.ok).toBe(true);
      expect(response.result.isValid).toBe(false);
    });
  });

  describe('security: input limits', () => {
    it('should reject oversized input', () => {
      const hugeInput = JSON.stringify({
        apiVersion: '1.0',
        operation: 'validate',
        yieldId: 'ethereum-eth-lido-staking',
        unsignedTransaction: 'x'.repeat(200 * 1024), // 200KB - over 100KB limit
        userAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0beb8',
      });

      const response = JSON.parse(handleJsonRequest(hugeInput));

      expect(response.ok).toBe(false);
      expect(response.error.code).toBe('SCHEMA_VALIDATION_ERROR');
      expect(response.error.message).toContain('exceeds maximum size');
    });
  });

  describe('response integrity', () => {
    it('should include consistent requestHash for same input', () => {
      const input = { apiVersion: '1.0', operation: 'getSupportedYieldIds' };

      const response1 = call(input);
      const response2 = call(input);

      expect(response1.meta.requestHash).toBe(response2.meta.requestHash);
    });

    it('should include different requestHash for different input', () => {
      const response1 = call({
        apiVersion: '1.0',
        operation: 'getSupportedYieldIds',
      });
      const response2 = call({
        apiVersion: '1.0',
        operation: 'isSupported',
        yieldId: 'x',
      });

      expect(response1.meta.requestHash).not.toBe(response2.meta.requestHash);
    });
  });
});
