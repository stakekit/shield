import { Shield } from '../../../shield';
import { TransactionType } from '../../../types';
import { ethers } from 'ethers';

describe('RocketPoolValidator via Shield', () => {
  const shield = new Shield();
  const yieldId = 'ethereum-eth-reth-staking';
  const userAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';
  const rETHAddress = '0xae78736Cd615f374D3085123A210448E74Fc6393';
  const rocketSwapRouterAddress =
    '0x16D5A408e807db8eF7c578279BEeEe6b228f1c1C';

  const iface = new ethers.Interface([
    'function swapTo(uint256 _uniswapPortion, uint256 _balancerPortion, uint256 _minTokensOut, uint256 _idealTokensOut) payable',
    'function approve(address spender, uint256 amount) returns (bool)',
  ]);

  const lifiSpender = '0x1111111254EEB25477B68fb85Ed929f73A960582';

  const stakeCalldata = iface.encodeFunctionData('swapTo', [
    5000n,
    5000n,
    900000000000000000n,
    950000000000000000n,
  ]);

  const approveCalldata = iface.encodeFunctionData('approve', [
    lifiSpender,
    1000000000000000000n,
  ]);

  describe('isSupported', () => {
    it('should support ethereum-eth-reth-staking yield', () => {
      expect(shield.isSupported(yieldId)).toBe(true);
      expect(shield.getSupportedYieldIds()).toContain(yieldId);
    });
  });

  describe('STAKE transactions', () => {
    it('should validate a valid stake transaction', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should validate EIP-1559 stake transaction', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        maxFeePerGas: '0x6fc23ac00',
        maxPriorityFeePerGas: '0x3b9aca00',
        chainId: 1,
        type: 2,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should accept string chainId "1"', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: '1',
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject stake to wrong contract', () => {
      const tx = {
        to: '0x0000000000000000000000000000000000000001',
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const stakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.STAKE,
      );
      expect(stakeAttempt?.reason).toContain(
        'not to RocketPool SwapRouter contract',
      );
    });

    it('should reject stake with wrong method', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject stake with zero ETH value', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0x0',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const stakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.STAKE,
      );
      expect(stakeAttempt?.reason).toContain('must send ETH value');
    });

    it('should reject stake with no value field', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const stakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.STAKE,
      );
      expect(stakeAttempt?.reason).toContain('must send ETH value');
    });

    it('should reject stake from wrong user', () => {
      const wrongUser = '0x0000000000000000000000000000000000000001';
      const tx = {
        to: rocketSwapRouterAddress,
        from: wrongUser,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject stake on wrong network', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 137,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject stake with appended bytes', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata + 'deadbeef',
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const stakeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.STAKE,
      );
      expect(stakeAttempt?.reason).toContain('calldata has been tampered');
    });

    it('should reject invalid JSON transaction', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: 'invalid-json',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });

  describe('APPROVAL transactions', () => {
    it('should validate a valid approval transaction', () => {
      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject approval to wrong contract', () => {
      const tx = {
        to: '0x0000000000000000000000000000000000000001',
        from: userAddress,
        value: '0x0',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const approvalAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.APPROVAL,
      );
      expect(approvalAttempt?.reason).toContain(
        'not to RocketPool rETH contract',
      );
    });

    it('should reject approval with wrong method', () => {
      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject approval with ETH value', () => {
      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const approvalAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.APPROVAL,
      );
      expect(approvalAttempt?.reason).toContain(
        'should not send ETH value',
      );
    });

    it('should reject approval with zero amount', () => {
      const zeroApproveCalldata = iface.encodeFunctionData('approve', [
        lifiSpender,
        0n,
      ]);

      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: zeroApproveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const approvalAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.APPROVAL,
      );
      expect(approvalAttempt?.reason).toContain(
        'amount must be greater than zero',
      );
    });

    it('should reject approval from wrong user', () => {
      const wrongUser = '0x0000000000000000000000000000000000000001';
      const tx = {
        to: rETHAddress,
        from: wrongUser,
        value: '0x0',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject approval on wrong network', () => {
      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 137,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject approval with appended bytes', () => {
      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: approveCalldata + 'deadbeef',
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const approvalAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.APPROVAL,
      );
      expect(approvalAttempt?.reason).toContain('calldata has been tampered');
    });

    it('should accept max uint256 approval amount', () => {
      const maxUint256 = (1n << 256n) - 1n;
      const maxApproveCalldata = iface.encodeFunctionData('approve', [
        lifiSpender,
        maxUint256,
      ]);

      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: maxApproveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });

    it('should accept approval with any spender address', () => {
      const randomSpender = '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF';
      const dynamicApproveCalldata = iface.encodeFunctionData('approve', [
        randomSpender,
        1000000000000000000n,
      ]);

      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: dynamicApproveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('Auto-detection', () => {
    it('should detect swapTo as STAKE', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.STAKE);
    });

    it('should detect approve as APPROVAL', () => {
      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.APPROVAL);
    });

    it('should reject unknown calldata', () => {
      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: '0xdeadbeef',
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should not produce ambiguous matches', () => {
      const stakeTx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const stakeResult = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(stakeTx),
        userAddress,
      });

      expect(stakeResult.isValid).toBe(true);
      expect(stakeResult.detectedType).toBeDefined();

      const approveTx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: approveCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const approveResult = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(approveTx),
        userAddress,
      });

      expect(approveResult.isValid).toBe(true);
      expect(approveResult.detectedType).toBeDefined();
    });
  });

  describe('General validation', () => {
    it('should reject transaction from wrong user', () => {
      const wrongUser = '0x0000000000000000000000000000000000000001';
      const tx = {
        to: rocketSwapRouterAddress,
        from: wrongUser,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 1,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject transaction on wrong network', () => {
      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: stakeCalldata,
        nonce: 0,
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        chainId: 137,
        type: 0,
      };

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });

    it('should reject malformed transaction data', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: 'not-json',
        userAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
    });
  });
});