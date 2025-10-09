import { Shield } from './shield';
import { TransactionType } from './types';
import { validatorRegistry } from './validators';

describe('Shield', () => {
  const shield: Shield = new Shield();

  describe('getSupportedYieldIds', () => {
    it('should return an array of supported yield IDs', () => {
      const yieldIds = shield.getSupportedYieldIds();

      expect(Array.isArray(yieldIds)).toBe(true);
      expect(yieldIds).toContain('ethereum-eth-lido-staking');
      expect(yieldIds).toContain('solana-sol-native-multivalidator-staking');
      expect(yieldIds).toContain('tron-trx-native-staking');
    });
  });

  describe('isSupported', () => {
    it('should return true for supported yields', () => {
      expect(shield.isSupported('ethereum-eth-lido-staking')).toBe(true);
      expect(
        shield.isSupported('solana-sol-native-multivalidator-staking'),
      ).toBe(true);
      expect(shield.isSupported('tron-trx-native-staking')).toBe(true);
    });

    it('should return false for unsupported yields', () => {
      expect(shield.isSupported('unknown-yield')).toBe(false);
      expect(shield.isSupported('fake-protocol')).toBe(false);
    });
  });

  describe('validate', () => {
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

    const validLidoClaimTx = {
      to: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1', // Lido withdrawal queue
      from: userAddress,
      value: '0x0',
      data:
        '0xf8444436' + // claimWithdrawal function selector
        '000000000000000000000000000000000000000000000000000000000000007b', // requestId (123)
      chainId: 1,
    };

    it('should validate request with missing parameters', () => {
      const result = shield.validate(null as any);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Missing validation request');
      expect(result.detectedType).toBeUndefined();
    });

    it('should validate request with invalid parameters', () => {
      const result = shield.validate({
        unsignedTransaction: '',
        yieldId: 'ethereum-eth-lido-staking',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid request parameters');
      expect(result.detectedType).toBeUndefined();
    });

    it('should validate request with unknown yield', () => {
      const result = shield.validate({
        unsignedTransaction: JSON.stringify(validLidoStakeTx),
        yieldId: 'unknown-yield',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Unknown yield ID');
      expect(result.detectedType).toBeUndefined();
    });

    describe('Auto-detection for different transaction types', () => {
      it('should auto-detect STAKE transaction', () => {
        const result = shield.validate({
          unsignedTransaction: JSON.stringify(validLidoStakeTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(true);
        expect(result.detectedType).toBe(TransactionType.STAKE);
        expect(result.reason).toBeUndefined();
      });

      it('should auto-detect UNSTAKE transaction', () => {
        const result = shield.validate({
          unsignedTransaction: JSON.stringify(validLidoUnstakeTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(true);
        expect(result.detectedType).toBe(TransactionType.UNSTAKE);
        expect(result.reason).toBeUndefined();
      });

      it('should auto-detect CLAIM_UNSTAKED transaction', () => {
        const result = shield.validate({
          unsignedTransaction: JSON.stringify(validLidoClaimTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(true);
        expect(result.detectedType).toBe(TransactionType.CLAIM_UNSTAKED);
        expect(result.reason).toBeUndefined();
      });

      it('should enforce unique pattern matching', () => {
        const lidoStakeResult = shield.validate({
          unsignedTransaction: JSON.stringify(validLidoStakeTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(lidoStakeResult.isValid).toBe(true);
        expect(lidoStakeResult.detectedType).toBe(TransactionType.STAKE);

        const wrongPatternResult = shield.validate({
          unsignedTransaction: JSON.stringify({
            to: '0xwrong',
            data: '0xrandom',
          }),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(wrongPatternResult.isValid).toBe(false);
        expect(wrongPatternResult.detectedType).toBeUndefined();
      });

      it('should detect correct type even when trying different order', () => {
        const result = shield.validate({
          unsignedTransaction: JSON.stringify(validLidoClaimTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(true);
        expect(result.detectedType).toBe(TransactionType.CLAIM_UNSTAKED);
      });
    });

    describe('Failed validations', () => {
      it('should reject transaction that matches no patterns and not set detectedType', () => {
        const invalidTx = {
          to: '0x0000000000000000000000000000000000000000',
          from: userAddress,
          value: '0x0',
          data: '0x',
          chainId: 1,
        };

        const result = shield.validate({
          unsignedTransaction: JSON.stringify(invalidTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('No matching operation pattern found');
        expect(result.detectedType).toBeUndefined();
      });

      it('should include attempts in details when no pattern matches', () => {
        const invalidTx = {
          to: '0x0000000000000000000000000000000000000000',
          from: userAddress,
          value: '0x0',
          data: '0x',
          chainId: 1,
        };

        const result = shield.validate({
          unsignedTransaction: JSON.stringify(invalidTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(false);
        expect(result.detectedType).toBeUndefined();
        expect(result.details?.attempts).toBeDefined();
        expect(Array.isArray(result.details?.attempts)).toBe(true);
        expect(result.details?.attempts?.length).toBe(3); // STAKE, UNSTAKE, CLAIM_UNSTAKED

        result.details?.attempts?.forEach((attempt: any) => {
          expect(attempt.type).toBeDefined();
          expect(attempt.reason).toBeDefined();
        });
      });

      it('should not set detectedType for transactions that fail validation', () => {
        const invalidReferralTx = {
          to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
          from: userAddress,
          value: '0xde0b6b3a7640000',
          data:
            '0xa1903eab' +
            '0000000000000000000000000000000000000000000000000000000000000000', // wrong referral
          chainId: 1,
        };

        const result = shield.validate({
          unsignedTransaction: JSON.stringify(invalidReferralTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('No matching operation pattern found');
        expect(result.detectedType).toBeUndefined();
      });

      it('should not set detectedType for wrong user address', () => {
        const wrongUserTx = {
          to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
          from: '0x0000000000000000000000000000000000000001', // wrong from address
          value: '0xde0b6b3a7640000',
          data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
          chainId: 1,
        };

        const result = shield.validate({
          unsignedTransaction: JSON.stringify(wrongUserTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('No matching operation pattern found');
        expect(result.detectedType).toBeUndefined();
      });

      it('should not allow for two or more matches', () => {
        // Create a mock validator that returns multiple valid matches
        const mockValidator = {
          getSupportedTransactionTypes: jest
            .fn()
            .mockReturnValue([
              TransactionType.STAKE,
              TransactionType.UNSTAKE,
              TransactionType.CLAIM_UNSTAKED,
            ]),
          validate: jest.fn().mockImplementation((_, transactionType) => {
            // Mock to return valid for both STAKE and UNSTAKE
            if (
              transactionType === TransactionType.STAKE ||
              transactionType === TransactionType.UNSTAKE
            ) {
              return { isValid: true };
            }
            return { isValid: false, reason: 'Not supported' };
          }),
        };

        // Store the original validator
        const originalValidator = validatorRegistry.get(
          'ethereum-eth-lido-staking',
        );

        // Temporarily replace the validator in the registry
        (validatorRegistry as any).set(
          'ethereum-eth-lido-staking',
          mockValidator,
        );

        const result = shield.validate({
          unsignedTransaction: JSON.stringify(validLidoStakeTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(
          'Ambiguous transaction pattern detected',
        );
        expect(result.reason).toContain(
          'Transaction matches multiple operation types',
        );
        expect(result.details?.matchedTypes).toEqual([
          TransactionType.STAKE,
          TransactionType.UNSTAKE,
        ]);
        expect(result.details?.warning).toContain(
          'A legitimate transaction must match exactly one pattern',
        );
        expect(result.detectedType).toBeUndefined();

        // Restore the original validator
        if (originalValidator) {
          (validatorRegistry as any).set(
            'ethereum-eth-lido-staking',
            originalValidator,
          );
        }
      });

      it('should handle validator throwing an error', () => {
        // Create a mock validator that throws an error
        const mockValidator = {
          getSupportedTransactionTypes: jest
            .fn()
            .mockReturnValue([TransactionType.STAKE]),
          validate: jest.fn().mockImplementation(() => {
            throw new Error('Validator internal error');
          }),
        };

        // Store the original validator
        const originalValidator = validatorRegistry.get(
          'ethereum-eth-lido-staking',
        );

        // Temporarily replace the validator in the registry
        (validatorRegistry as any).set(
          'ethereum-eth-lido-staking',
          mockValidator,
        );

        const result = shield.validate({
          unsignedTransaction: JSON.stringify(validLidoStakeTx),
          yieldId: 'ethereum-eth-lido-staking',
          userAddress,
        });

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('No matching operation pattern found');
        expect(result.details?.attempts).toBeDefined();
        expect(Array.isArray(result.details?.attempts)).toBe(true);
        expect(result.details?.attempts?.length).toBe(1);
        expect(result.details?.attempts?.[0].type).toBe(TransactionType.STAKE);
        expect(result.details?.attempts?.[0].reason).toBe(
          'Validator internal error',
        );
        expect(result.detectedType).toBeUndefined();

        // Restore the original validator
        if (originalValidator) {
          (validatorRegistry as any).set(
            'ethereum-eth-lido-staking',
            originalValidator,
          );
        }
      });
    });
  });
});
