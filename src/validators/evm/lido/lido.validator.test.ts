import { Shield } from '../../../shield';
import { TransactionType } from '../../../types';

describe('LidoValidator via Shield', () => {
  const shield = new Shield();
  const yieldId = 'ethereum-eth-lido-staking';
  const userAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';
  const lidoStEthAddress = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
  const lidoWithdrawalQueueAddress =
    '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1';
  const referralAddress = '0x371240E80Bf84eC2bA8b55aE2fD0B467b16Db2be'; // Actual Lido referral

  describe('isSupported', () => {
    it('should support ethereum-eth-lido-staking yield', () => {
      expect(shield.isSupported(yieldId)).toBe(true);
      expect(shield.getSupportedYieldIds()).toContain(yieldId);
    });
  });

  describe('STAKE transactions', () => {
    it('should validate a valid stake transaction', () => {
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000', // 1 ETH in hex
        data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'), // submit(referral)
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should validate EIP-1559 stake transaction', () => {
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
        nonce: 0,
        gasLimit: '0x30d40',
        maxFeePerGas: '0x6fc23ac00',
        maxPriorityFeePerGas: '0x3b9aca00',
        chainId: 1,
        type: 2,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should accept string chainId "1"', () => {
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: '1', // String instead of number
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject stake to wrong contract', () => {
      const tx = {
        to: '0x0000000000000000000000000000000000000001',
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      // Check the specific error in the attempts
      const stakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.STAKE,
      );
      expect(stakeAttempt?.reason).toContain('not to Lido stETH contract');
    });

    it('should reject stake with wrong method', () => {
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: '0x095ea7b3' + referralAddress.slice(2).padStart(64, '0'), // Wrong method (approve)
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Invalid method for staking');
    });

    it('should reject stake with wrong referral address', () => {
      const wrongReferral = '0x0000000000000000000000000000000000000001';
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: '0xa1903eab' + wrongReferral.slice(2).padStart(64, '0'),
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Invalid referral address');
    });

    it('should reject stake transaction with appended bytes', () => {
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0') + 'deadbeef', // Extra bytes appended
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const stakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.STAKE,
      );
      expect(stakeAttempt?.reason).toContain('calldata has been tampered');
    });

    it('should validate STAKE transaction', () => {
      const real = {
        from: '0x4546fC1b71375eA0fa4D8cA32B9F2C2ED4FB2E82',
        gasLimit: '0x01626a',
        value: '90000000000000',
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0xa1903eab000000000000000000000000371240e80bf84ec2ba8b55ae2fd0b467b16db2be',
        nonce: 27,
        type: 2,
        maxFeePerGas: '0x18701a80',
        maxPriorityFeePerGas: '0x054e0840',
        chainId: 1,
      };

      const serialized = JSON.stringify(real);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress: real.from,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('UNSTAKE transactions', () => {
    it('should validate a valid unstake transaction', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xd6681042' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '000000000000000000000000' +
          userAddress.slice(2) +
          '0000000000000000000000000000000000000000000000000000000000000001' +
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000', // 1 ETH
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject unstake with wrong owner', () => {
      const wrongOwner = '0x0000000000000000000000000000000000000001';
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xd6681042' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '000000000000000000000000' +
          wrongOwner.slice(2) +
          '0000000000000000000000000000000000000000000000000000000000000001' +
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000',
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('owner is not user address');
    });

    it('should reject unstake to wrong contract', () => {
      const tx = {
        to: '0x0000000000000000000000000000000000000001',
        from: userAddress,
        value: '0x0',
        data:
          '0xd6681042' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '000000000000000000000000' +
          userAddress.slice(2) +
          '0000000000000000000000000000000000000000000000000000000000000001' +
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000',
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('not to Lido Withdrawal Queue contract');
    });

    it('should reject unstake with ETH value', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000', // Should be 0
        data:
          '0xd6681042' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '000000000000000000000000' +
          userAddress.slice(2) +
          '0000000000000000000000000000000000000000000000000000000000000001' +
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000',
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Unstake should not send ETH value');
    });

    it('should reject unstake with empty amounts array', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xd6681042' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '000000000000000000000000' +
          userAddress.slice(2) +
          '0000000000000000000000000000000000000000000000000000000000000000', // Empty array
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Withdrawal amounts array is empty');
    });

    it('should reject unstake transaction with appended bytes', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xd6681042' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '000000000000000000000000' +
          userAddress.slice(2) +
          '0000000000000000000000000000000000000000000000000000000000000001' +
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000' +
          'cafebabe', // Extra bytes
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const unstakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.UNSTAKE,
      );
      expect(unstakeAttempt?.reason).toContain('calldata has been tampered');
    });

    it('should reject unstake with multiple amounts and appended bytes', () => {
      // requestWithdrawals([1 ETH, 2 ETH], owner) + extra bytes
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xd6681042' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '000000000000000000000000' +
          userAddress.slice(2) +
          '0000000000000000000000000000000000000000000000000000000000000002' + // 2 amounts
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000' + // 1 ETH
          '0000000000000000000000000000000000000000000000001bc16d674ec80000' + // 2 ETH
          '12345678', // Extra bytes
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      const unstakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.UNSTAKE,
      );
      expect(unstakeAttempt?.reason).toContain('calldata has been tampered');
    });

    it('should validate UNSTAKE transaction', () => {
      const real = {
        from: '0x034A21184A8832EBa5D9fcD61D533D0d641ECe12',
        to: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
        data: '0xd66810420000000000000000000000000000000000000000000000000000000000000040000000000000000000000000034a21184a8832eba5d9fcd61d533d0d641ece12000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000038d7ea4c68000',
        value: '0',
        gasLimit: '300000',
        nonce: 66,
        chainId: 1,
        maxFeePerGas: '6235129060',
        maxPriorityFeePerGas: '2097824',
        type: 2,
      } as const;

      const serialized = JSON.stringify(real);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress: real.from,
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject APPROVAL transaction when treated as UNSTAKE', () => {
      const approval = {
        from: '0x034A21184A8832EBa5D9fcD61D533D0d641ECe12',
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data:
          '0x095ea7b3000000000000000000000000889edc2edab5f40e902b864ad4d7ade8e412f9b1' +
          '00000000000000000000000000000000000000000000000000038d7ea4c68000',
        value: '0',
        gasLimit: '76153',
        nonce: 65,
        chainId: 1,
        maxFeePerGas: '6235129060',
        maxPriorityFeePerGas: '2097824',
        type: 2,
      } as const;

      const serialized = JSON.stringify(approval);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress: approval.from,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('not to Lido Withdrawal Queue contract');
    });
  });

  describe('CLAIM_UNSTAKED transactions', () => {
    it('should validate a valid single claim transaction', () => {
      const requestId = 123n;
      const encodedParams = requestId.toString(16).padStart(64, '0');

      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data: '0xf8444436' + encodedParams,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should validate a valid batch claim transaction', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xe3afe0a3' +
          '0000000000000000000000000000000000000000000000000000000000000040' + // requestIds offset
          '00000000000000000000000000000000000000000000000000000000000000a0' + // hints offset
          '0000000000000000000000000000000000000000000000000000000000000002' + // requestIds length
          '000000000000000000000000000000000000000000000000000000000000007b' + // requestId 123
          '000000000000000000000000000000000000000000000000000000000000007c' + // requestId 124
          '0000000000000000000000000000000000000000000000000000000000000002' + // hints length
          '0000000000000000000000000000000000000000000000000000000000000001' + // hint 1
          '0000000000000000000000000000000000000000000000000000000000000001', // hint 1
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject claim with wrong method', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data: '0x095ea7b3' + '00'.repeat(32), // Wrong method (approve)
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Invalid transaction data for claiming');
    });

    it('should reject claim with ETH value', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000', // Should not send ETH
        data:
          '0xf8444436' +
          '000000000000000000000000000000000000000000000000000000000000007b',
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Claim should not send ETH value');
    });

    it('should reject batch claim with empty requestIds array', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xe3afe0a3' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '0000000000000000000000000000000000000000000000000000000000000060' +
          '0000000000000000000000000000000000000000000000000000000000000000' + // requestIds length = 0
          '0000000000000000000000000000000000000000000000000000000000000000', // hints length = 0
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Request IDs array is empty');
    });

    it('should reject batch claim with mismatched arrays length', () => {
      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data:
          '0xe3afe0a3' +
          '0000000000000000000000000000000000000000000000000000000000000040' +
          '00000000000000000000000000000000000000000000000000000000000000a0' +
          '0000000000000000000000000000000000000000000000000000000000000002' + // requestIds length = 2
          '000000000000000000000000000000000000000000000000000000000000007b' +
          '000000000000000000000000000000000000000000000000000000000000007c' +
          '0000000000000000000000000000000000000000000000000000000000000001' + // hints length = 1 (mismatch!)
          '0000000000000000000000000000000000000000000000000000000000000001',
        nonce: 0,
        gasLimit: '0x493e0',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('arrays length mismatch');
    });

    it('should reject claimWithdrawal with appended bytes', () => {
      const requestId = 123n;
      const encodedParams = requestId.toString(16).padStart(64, '0');

      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data: '0xf8444436' + encodedParams + '12345678', // Extra bytes
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const claimAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.CLAIM_UNSTAKED,
      );
      expect(claimAttempt?.reason).toContain('calldata has been tampered');
    });

    it('should reject claimWithdrawals with appended bytes', () => {
      // Generate VALID calldata using ethers
      const { ethers } = require('ethers');
      const iface = new ethers.Interface([
        'function claimWithdrawals(uint256[] _requestIds, uint256[] _hints)',
      ]);
      
      const validCalldata = iface.encodeFunctionData('claimWithdrawals', [
        [1n, 2n], // requestIds
        [100n, 200n], // hints
      ]);
      
      // Append malicious bytes
      const tamperedCalldata = validCalldata + 'cafebabe';

      const tx = {
        to: lidoWithdrawalQueueAddress,
        from: userAddress,
        value: '0x0',
        data: tamperedCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      const claimAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.CLAIM_UNSTAKED,
      );
      expect(claimAttempt?.reason).toContain('calldata has been tampered');
    });

    it('should validate batch CLAIM_UNSTAKED transaction', () => {
      const real = {
        from: '0x6877BB79f680216BbdF01704939037F22193e771',
        to: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
        data: '0xe3afe0a300000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000171030000000000000000000000000000000000000000000000000000000000017107000000000000000000000000000000000000000000000000000000000001710a000000000000000000000000000000000000000000000000000000000001710d0000000000000000000000000000000000000000000000000000000000017112000000000000000000000000000000000000000000000000000000000001711b000000000000000000000000000000000000000000000000000000000001711f0000000000000000000000000000000000000000000000000000000000017438000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000003510000000000000000000000000000000000000000000000000000000000000351000000000000000000000000000000000000000000000000000000000000035100000000000000000000000000000000000000000000000000000000000003510000000000000000000000000000000000000000000000000000000000000351000000000000000000000000000000000000000000000000000000000000035100000000000000000000000000000000000000000000000000000000000003510000000000000000000000000000000000000000000000000000000000000355',
        value: '0',
        gasLimit: '390177',
        nonce: 377,
        chainId: 1,
        maxFeePerGas: '445860382',
        maxPriorityFeePerGas: '7000',
        type: 2,
      } as const;

      const serialized = JSON.stringify(real);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress: real.from,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('General validation', () => {
    it('should reject transaction from wrong user', () => {
      const wrongUser = '0x0000000000000000000000000000000000000001';
      const tx = {
        to: lidoStEthAddress,
        from: wrongUser,
        value: '0xde0b6b3a7640000',
        data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('not from user address');
    });

    it('should reject unsupported transaction type', () => {
      // Create a transaction with an invalid function selector that doesn't match any supported types
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0x0',
        data: '0xdeadbeef', // Invalid function selector
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      // Shield will try all transaction types and none will match the invalid transaction
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject transaction on wrong network', () => {
      const tx = {
        to: lidoStEthAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: '0xa1903eab' + referralAddress.slice(2).padStart(64, '0'),
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 137, // Polygon
        type: 0,
      };

      const serialized = JSON.stringify(tx);
      const result = shield.validate({
        yieldId,
        unsignedTransaction: serialized,
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      // Previously: toContain('Lido only supported on Ethereum mainnet');
    });

    it('should reject invalid transaction data', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: 'invalid-json',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found'); // Previously: toContain('Failed to decode EVM transaction');
    });
  });
});
