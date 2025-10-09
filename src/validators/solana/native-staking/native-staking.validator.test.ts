import {
  ComputeBudgetProgram,
  PublicKey,
  StakeProgram,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { Shield } from '../../../shield';
import { TransactionType } from '../../../types';

describe('SolanaNativeStakingValidator via Shield', () => {
  const shield = new Shield();
  const yieldId = 'solana-sol-native-multivalidator-staking';
  const userAddress = '29LDedMM8bYERotXSvUhBaXeWWdgi5kqwu4YBxAPLamy';

  describe('isSupported', () => {
    it('should support solana-sol-native-multivalidator-staking yield', () => {
      expect(shield.isSupported(yieldId)).toBe(true);
      expect(shield.getSupportedYieldIds()).toContain(yieldId);
    });
  });

  describe('STAKE validation', () => {
    it('should reject malformed STAKE transaction', async () => {
      const userPubkey = new PublicKey(userAddress);

      // Test with incomplete transaction (missing required instructions)
      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      // Missing required stake instructions

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject STAKE with missing SetComputeUnitLimit', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      // Missing SetComputeUnitLimit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitLimit'),
        ),
      ).toBe(true);
    });

    it('should reject STAKE with missing SetComputeUnitPrice', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      // Missing SetComputeUnitPrice
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitPrice'),
        ),
      ).toBe(true);
    });

    it('should reject STAKE with wrong CreateAccountWithSeed source', async () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousPubkey = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: maliciousPubkey, // Wrong source!
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'CreateAccountWithSeed source is not user address',
          ),
        ),
      ).toBe(true);
    });

    it('should reject STAKE with wrong Initialize stake account', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const wrongStakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: wrongStakeAccount, // Wrong stake account!
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Delegate stake account does not match new stake account',
          ),
        ),
      ).toBe(true);
    });

    it('should reject STAKE with wrong Delegate stake account', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const wrongStakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: wrongStakeAccount, // Wrong stake account!
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Delegate stake account does not match new stake account',
          ),
        ),
      ).toBe(true);
    });

    it('should accept valid STAKE transaction with validator address validation', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
        args: { validatorAddress: validatorAddress.toBase58() },
      });
      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.STAKE);
    });

    it('should reject STAKE with wrong validator address', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );
      const wrongValidatorAddress = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
        args: { validatorAddress: wrongValidatorAddress.toBase58() },
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Validator address does not match expected'),
        ),
      ).toBe(true);
    });

    it('should accept valid STAKE transaction without fee', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });
      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.STAKE);
    });

    it('should reject STAKE with wrong delegate authority', async () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousPubkey = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: maliciousPubkey, // Wrong authority!
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      // Check the specific error in the attempts
      const stakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.STAKE,
      );
      expect(stakeAttempt?.reason).toContain(
        'Delegate authority is not user address',
      );
    });

    it('should reject STAKE transaction with wrong staker authorization', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );
      const feeRecipientPubkey = new PublicKey(
        'HaAebbtwqajTNEBJ2ys3yxWJXk6fi7tk7WXpvj6hMEXZ',
      );
      const wrongRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: feeRecipientPubkey,
          lamports: 1000000,
        }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: wrongRecipient, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
    });

    it('should reject STAKE transaction with wrong withdrawer authorization', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );
      const validatorAddress = new PublicKey(
        'BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x',
      );
      const feeRecipientPubkey = new PublicKey(
        'HaAebbtwqajTNEBJ2ys3yxWJXk6fi7tk7WXpvj6hMEXZ',
      );
      const wrongRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: feeRecipientPubkey,
          lamports: 1000000,
        }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: wrongRecipient },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );
      transaction.add(
        StakeProgram.delegate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          votePubkey: validatorAddress,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('UNSTAKE validation', () => {
    it('should reject UNSTAKE with too few instructions', () => {
      const userPubkey = new PublicKey(userAddress);

      // Only 2 instructions instead of minimum 3
      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      // Missing Deactivate instruction

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Invalid instruction count for UNSTAKE'),
        ),
      ).toBe(true);
    });

    it('should reject UNSTAKE with too many instructions', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      // 13 instructions instead of maximum 12
      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      // Add 11 deactivate instructions (total 13)
      Array.from({ length: 11 }, () =>
        transaction.add(
          StakeProgram.deactivate({
            stakePubkey: stakeAccount,
            authorizedPubkey: userPubkey,
          }),
        ),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Invalid instruction count for UNSTAKE'),
        ),
      ).toBe(true);
    });

    it('should reject UNSTAKE with missing SetComputeUnitLimit', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      // Missing SetComputeUnitLimit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitLimit'),
        ),
      ).toBe(true);
    });

    it('should reject UNSTAKE with missing SetComputeUnitPrice', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      // Missing SetComputeUnitPrice
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitPrice'),
        ),
      ).toBe(true);
    });

    it('should reject UNSTAKE with non-Deactivate instruction in loop', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
      );
      // Add a non-Deactivate instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 1000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Instruction 3 must be a Deactivate instruction',
          ),
        ),
      );
    });

    it('should accept valid UNSTAKE transaction', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNSTAKE);
    });

    it('should reject UNSTAKE with wrong authority', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousPubkey = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: maliciousPubkey, // Wrong!
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });

  describe('WITHDRAW validation', () => {
    it('should reject WITHDRAW with wrong instruction count', () => {
      const userPubkey = new PublicKey(userAddress);

      // Only 2 instructions instead of 3
      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      // Missing Withdraw instruction

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Invalid instruction count for WITHDRAW'),
        ),
      ).toBe(true);
    });

    it('should reject WITHDRAW with missing SetComputeUnitLimit', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      // Missing SetComputeUnitLimit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitLimit'),
        ),
      ).toBe(true);
    });

    it('should reject WITHDRAW with missing SetComputeUnitPrice', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      // Missing SetComputeUnitPrice
      transaction.add(
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitPrice'),
        ),
      ).toBe(true);
    });

    it('should reject WITHDRAW with missing Withdraw instruction', () => {
      const userPubkey = new PublicKey(userAddress);

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      // Add wrong instruction instead of Withdraw
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 1000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid Withdraw instruction'),
        ),
      );
    });

    it('should accept valid WITHDRAW transaction', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.WITHDRAW);
    });

    it('should reject WITHDRAW to wrong toPubkey recipient', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: maliciousRecipient, // Wrong recipient!
          lamports: 100000000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject WITHDRAW to wrong authorizedPubkey recipient', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: maliciousRecipient, // Wrong authorizedPubkey!
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });

  describe('WITHDRAW_ALL validation', () => {
    it('should reject WITHDRAW_ALL with too few instructions', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      // Only 3 instructions instead of minimum 4
      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
      );
      // Need at least one more withdraw instruction for WITHDRAW_ALL

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(true); // Will match regular WITHDRAW
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Invalid instruction count for WITHDRAW_ALL',
          ),
        ),
      );
    });

    it('should reject WITHDRAW_ALL with missing SetComputeUnitLimit', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      // Missing SetComputeUnitLimit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      Array.from({ length: 2 }, (_, i) =>
        transaction.add(
          StakeProgram.withdraw({
            stakePubkey: stakeAccount,
            authorizedPubkey: userPubkey,
            toPubkey: userPubkey,
            lamports: 100000000 + i * 100,
          }),
        ),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitLimit'),
        ),
      ).toBe(true);
    });

    it('should reject WITHDRAW_ALL with missing SetComputeUnitPrice', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      // Missing SetComputeUnitPrice

      Array.from({ length: 2 }, (_, i) =>
        transaction.add(
          StakeProgram.withdraw({
            stakePubkey: stakeAccount,
            authorizedPubkey: userPubkey,
            toPubkey: userPubkey,
            lamports: 100000000 + i * 100,
          }),
        ),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitPrice'),
        ),
      ).toBe(true);
    });

    it('should reject WITHDRAW_ALL with non-Withdraw instruction in loop', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.withdraw({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 100000000,
        }),
      );
      // Add a non-Withdraw instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 1000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid Withdraw instruction'),
        ),
      ).toBe(true);
    });

    it('should accept valid WITHDRAW_ALL transaction', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      Array.from({ length: 10 }, (_, i) =>
        transaction.add(
          StakeProgram.withdraw({
            stakePubkey: stakeAccount,
            authorizedPubkey: userPubkey,
            toPubkey: userPubkey,
            lamports: 100000000 + i * 100,
          }),
        ),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.WITHDRAW_ALL);
    });

    it('should reject WITHDRAW_ALL to wrong toPubkey recipient', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      Array.from({ length: 10 }, (_, i) =>
        transaction.add(
          StakeProgram.withdraw({
            stakePubkey: stakeAccount,
            authorizedPubkey: userPubkey,
            toPubkey: i === 5 ? maliciousRecipient : userPubkey,
            lamports: 100000000 + i * 100,
          }),
        ),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject WITHDRAW_ALL to wrong authorizedPubkey recipient', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      Array.from({ length: 10 }, (_, i) =>
        transaction.add(
          StakeProgram.withdraw({
            stakePubkey: stakeAccount,
            authorizedPubkey: i === 5 ? maliciousRecipient : userPubkey,
            toPubkey: userPubkey,
            lamports: 100000000 + i * 100,
          }),
        ),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });

  describe('SPLIT validation', () => {
    it('should reject SPLIT with wrong instruction count', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      // Only 5 instructions instead of 6
      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(...splitWithSeedTx.instructions);
      // Missing Deactivate instruction

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Invalid instruction count for SPLIT'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with missing SetComputeUnitLimit', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      // Missing SetComputeUnitLimit
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(...splitWithSeedTx.instructions);
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitLimit'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with missing SetComputeUnitPrice', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      // Missing SetComputeUnitPrice

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(...splitWithSeedTx.instructions);
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid SetComputeUnitPrice'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with missing AllocateWithSeed', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      // Add wrong instruction instead of AllocateWithSeed
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: newStake,
          lamports: 2282880,
        }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[1]); // Split instruction
      transaction.add(splitWithSeedTx.instructions[2]); // Transfer instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid AllocateWithSeed'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with AllocateWithSeed source not user address', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousPubkey = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      // Create AllocateWithSeed with wrong source
      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: maliciousPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      transaction.add(splitWithSeedTx.instructions[1]); // Split instruction
      transaction.add(splitWithSeedTx.instructions[2]); // Transfer instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'AllocateWithSeed source is not user address',
          ),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with missing Transfer', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      // Skip Transfer instruction
      transaction.add(splitWithSeedTx.instructions[2]); // Split instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid Transfer'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with Transfer not from user address', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousPubkey = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: maliciousPubkey, // Wrong source!
          toPubkey: newStake,
          lamports: 2282880,
        }),
      );
      transaction.add(splitWithSeedTx.instructions[2]); // Split instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Transfer not from user address'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with Transfer recipient mismatch', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );
      const wrongRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: wrongRecipient, // Wrong recipient!
          lamports: 2282880,
        }),
      );
      transaction.add(splitWithSeedTx.instructions[2]); // Split instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Transfer recipient does not match new stake account',
          ),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with missing Split instruction', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      transaction.add(splitWithSeedTx.instructions[1]); // Transfer
      // Skip Split instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid Split instruction'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with Split stake account mismatch', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );
      const wrongStake = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      transaction.add(splitWithSeedTx.instructions[1]); // Transfer
      const fakeSplit = StakeProgram.split(
        {
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: wrongStake,
          lamports: 50000000,
        },
        123,
      );
      transaction.add(fakeSplit.instructions[1]); // Split instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Split stake account does not match new stake account',
          ),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with Split authority not user address', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousPubkey = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      transaction.add(splitWithSeedTx.instructions[1]); // Transfer
      // Use the correct split instruction from splitWithSeedTx
      const fakeSplit = StakeProgram.split(
        {
          stakePubkey: newStake,
          authorizedPubkey: maliciousPubkey,
          splitStakePubkey: newStake,
          lamports: 50000000,
        },
        123,
      );
      transaction.add(fakeSplit.instructions[1]); // Split instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Split authority is not user address'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with Transfer recipient not matching Split stake account', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );
      const wrongStake = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]); // AllocateWithSeed
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: wrongStake, // Wrong recipient!
          lamports: 2282880,
        }),
      );
      // Use the correct split instruction from splitWithSeedTx
      transaction.add(splitWithSeedTx.instructions[2]); // Split instruction
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Transfer recipient does not match new stake account',
          ),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with missing Deactivate instruction', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(...splitWithSeedTx.instructions);
      transaction.add(splitWithSeedTx.instructions[0]);
      // Missing Deactivate instruction

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Missing or invalid Deactivate instruction'),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with Deactivate stake account mismatch', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );
      const wrongStake = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(...splitWithSeedTx.instructions);
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: wrongStake, // Wrong stake account!
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes(
            'Deactivate stake account does not match new stake account',
          ),
        ),
      ).toBe(true);
    });

    it('should reject SPLIT with Deactivate authority not user address', () => {
      const userPubkey = new PublicKey(userAddress);
      const maliciousPubkey = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(...splitWithSeedTx.instructions);
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: maliciousPubkey, // Wrong authority!
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(
        result.details?.attempts?.some((attempt) =>
          attempt.reason?.includes('Deactivate authority is not user address'),
        ),
      ).toBe(true);
    });

    it('should accept valid SPLIT transaction', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(...splitWithSeedTx.instructions);
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.SPLIT);
    });

    it('should reject SPLIT with Transfer to wrong recipient', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );
      const maliciousRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: userPubkey,
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: maliciousRecipient, // Wrong!
          lamports: 2282880,
        }),
      );
      transaction.add(splitWithSeedTx.instructions[2]);
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject SPLIT with wrong authorizedPubkey recipient', () => {
      const userPubkey = new PublicKey(userAddress);
      const sourceStake = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const newStake = new PublicKey(
        '9ZmDXFKKaLb5ct3cqbfqHzJPaag4KbZdk3HgAVfCWpMc',
      );
      const maliciousRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );

      const splitWithSeedTx = StakeProgram.splitWithSeed(
        {
          stakePubkey: sourceStake,
          authorizedPubkey: maliciousRecipient, // Wrong!
          splitStakePubkey: newStake,
          basePubkey: userPubkey,
          seed: 'split',
          lamports: 50000000,
        },
        2282880,
      );

      transaction.add(splitWithSeedTx.instructions[0]);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: userPubkey,
          lamports: 2282880,
        }),
      );
      transaction.add(splitWithSeedTx.instructions[2]);
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: newStake,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });

  describe('Attack prevention', () => {
    it('should reject transaction with Authorize instruction', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const maliciousAuthority = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.authorize({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
          newAuthorizedPubkey: maliciousAuthority,
          stakeAuthorizationType: { index: 0 }, // Staker
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject transaction with extra instructions', () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = new PublicKey(
        'HzcH95P8DJnmjWfNLKeWYrNSYuMrbAGcp6MhXwWfeezk',
      );
      const maliciousRecipient = new PublicKey(
        '2ejUissotvQJda8tnD9iqYbdSuz6Gv6dxDnZE8hEKwr5',
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
      );
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: maliciousRecipient,
          lamports: 50000000,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });

  describe('Security: Instruction count enforcement', () => {
    it('should enforce exact instruction counts for all transaction types', () => {
      const userPubkey = new PublicKey(userAddress);

      const tooFew = new Transaction();
      tooFew.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }));
      tooFew.recentBlockhash = '11111111111111111111111111111111';
      tooFew.feePayer = userPubkey;
      const tooFewHex = tooFew
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const tooMany = new Transaction();
      Array.from({ length: 10 }, () =>
        tooMany.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
        ),
      );
      tooMany.recentBlockhash = '11111111111111111111111111111111';
      tooMany.feePayer = userPubkey;
      const tooManyHex = tooMany
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      // Shield will automatically try all transaction types
      const resultFew = shield.validate({
        yieldId,
        unsignedTransaction: tooFewHex,
        userAddress,
      });
      expect(resultFew.isValid).toBe(false);
      expect(resultFew.reason).toContain('No matching operation pattern found');

      const resultMany = shield.validate({
        yieldId,
        unsignedTransaction: tooManyHex,
        userAddress,
      });
      expect(resultMany.isValid).toBe(false);
      expect(resultMany.reason).toContain(
        'No matching operation pattern found',
      );
    });

    it('should block instruction substitution attacks', async () => {
      const userPubkey = new PublicKey(userAddress);
      const stakeAccount = await PublicKey.createWithSeed(
        userPubkey,
        'test',
        StakeProgram.programId,
      );

      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      );
      transaction.add(
        StakeProgram.createAccountWithSeed({
          fromPubkey: userPubkey,
          stakePubkey: stakeAccount,
          basePubkey: userPubkey,
          seed: 'test',
          authorized: { staker: userPubkey, withdrawer: userPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: PublicKey.default },
          lamports: 100000000,
        }),
      );

      transaction.add(
        StakeProgram.deactivate({
          stakePubkey: stakeAccount,
          authorizedPubkey: userPubkey,
        }),
      );

      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });

  describe('Error handling', () => {
    it('should reject invalid hex', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: 'invalid-hex',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject unsupported transaction type', () => {
      const userPubkey = new PublicKey(userAddress);
      const transaction = new Transaction();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
      );
      transaction.recentBlockhash = '11111111111111111111111111111111';
      transaction.feePayer = userPubkey;
      const txHex = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('hex');

      const result = shield.validate({
        yieldId,
        unsignedTransaction: txHex,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject transaction decode error', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: 'not-a-valid-transaction-hex',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject empty transaction', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: '',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Invalid request parameters');
    });

    it('should reject malformed transaction data', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: 'deadbeef',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });
});
