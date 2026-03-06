import { Shield } from '../../../shield';
import { TransactionType } from '../../../types';
import { ethers } from 'ethers';

describe('RocketPoolValidator via Shield', () => {
  const shield = new Shield();
  const yieldId = 'ethereum-eth-reth-staking';
  const userAddress = '0x742d35cc6634c0532925a3b844bc9e7595f0beb8';
  const rETHAddress = '0xae78736Cd615f374D3085123A210448E74Fc6393';
  const rocketSwapRouterAddress = '0x16D5A408e807db8eF7c578279BEeEe6b228f1c1C';

  const iface = new ethers.Interface([
    'function swapTo(uint256 _uniswapPortion, uint256 _balancerPortion, uint256 _minTokensOut, uint256 _idealTokensOut) payable',
    'function approve(address spender, uint256 amount) returns (bool)',
  ]);

  const lifiSpender = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE'; // LI.FI Diamond

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

  // --- LI.FI SWAP test setup ---
  const LIFI_DIAMOND = '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae';
  const LIFI_PERMIT2_PROXY = '0x89c6340b1a1f4b25d36cd8b063d49045caf3f818';

  const lifiSwapIface = new ethers.Interface([
    'function swapTokensSingleV3ERC20ToERC20(bytes32 _transactionId, string _integrator, string _referrer, address _receiver, uint256 _minAmountOut, (address callTo, address approveTo, address sendingAssetId, address receivingAssetId, uint256 fromAmount, bytes callData, bool requiresDeposit) _swapData)',
    'function swapTokensSingleV3ERC20ToNative(bytes32 _transactionId, string _integrator, string _referrer, address _receiver, uint256 _minAmountOut, (address callTo, address approveTo, address sendingAssetId, address receivingAssetId, uint256 fromAmount, bytes callData, bool requiresDeposit) _swapData)',
  ]);

  const permit2ProxyIface = new ethers.Interface([
    'function callDiamondWithPermit2(bytes _diamondCalldata, ((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) _permit, bytes _signature) payable returns (bytes)',
    'function callDiamondWithPermit2Witness(bytes _diamondCalldata, address _signer, ((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) _permit, bytes _signature) payable returns (bytes)',
    'function callDiamondWithEIP2612Signature(address tokenAddress, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s, bytes diamondCalldata) payable returns (bytes)',
  ]);

  const sampleSwapDataTuple = [
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000001',
    rETHAddress,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    1000000000000000000n,
    '0x',
    false,
  ];

  const diamondSwapCalldata = lifiSwapIface.encodeFunctionData(
    'swapTokensSingleV3ERC20ToNative',
    [
      ethers.zeroPadValue('0x01', 32),
      'stakekit',
      '',
      userAddress,
      900000000000000000n,
      sampleSwapDataTuple,
    ],
  );

  const diamondSingleV3SwapCalldata = lifiSwapIface.encodeFunctionData(
    'swapTokensSingleV3ERC20ToERC20',
    [
      ethers.zeroPadValue('0x02', 32),
      'stakekit',
      '',
      userAddress,
      900000000000000000n,
      sampleSwapDataTuple,
    ],
  );

  const wrongReceiverSwapCalldata = lifiSwapIface.encodeFunctionData(
    'swapTokensSingleV3ERC20ToNative',
    [
      ethers.zeroPadValue('0x01', 32),
      'stakekit',
      '',
      '0x0000000000000000000000000000000000000bad',
      900000000000000000n,
      sampleSwapDataTuple,
    ],
  );

  const dummyPermit = [[rETHAddress, 1000000000000000000n], 0n, 9999999999n];
  const dummySignature = '0x' + '00'.repeat(65);

  const permit2WrappedSwapCalldata = permit2ProxyIface.encodeFunctionData(
    'callDiamondWithPermit2',
    [diamondSwapCalldata, dummyPermit, dummySignature],
  );

  const permit2WitnessWrappedSwapCalldata =
    permit2ProxyIface.encodeFunctionData('callDiamondWithPermit2Witness', [
      diamondSwapCalldata,
      userAddress,
      dummyPermit,
      dummySignature,
    ]);

  const eip2612WrappedSwapCalldata = permit2ProxyIface.encodeFunctionData(
    'callDiamondWithEIP2612Signature',
    [
      rETHAddress,
      1000000000000000000n,
      9999999999n,
      27,
      ethers.zeroPadValue('0x01', 32),
      ethers.zeroPadValue('0x02', 32),
      diamondSwapCalldata,
    ],
  );

  const permit2WrongReceiverCalldata = permit2ProxyIface.encodeFunctionData(
    'callDiamondWithPermit2',
    [wrongReceiverSwapCalldata, dummyPermit, dummySignature],
  );

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
    it('should reject stake with zero minTokensOut', () => {
      const zeroMinCalldata = iface.encodeFunctionData('swapTo', [
        5000n,
        5000n,
        0n,
        950000000000000000n,
      ]);

      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: zeroMinCalldata,
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
        'Minimum tokens out must be greater than zero',
      );
    });

    it('should reject stake with zero idealTokensOut', () => {
      const zeroIdealCalldata = iface.encodeFunctionData('swapTo', [
        5000n,
        5000n,
        900000000000000000n,
        0n,
      ]);

      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: zeroIdealCalldata,
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
        'Ideal tokens out must be greater than zero',
      );
    });

    it('should reject stake where minTokensOut exceeds idealTokensOut', () => {
      const invertedCalldata = iface.encodeFunctionData('swapTo', [
        5000n,
        5000n,
        1000000000000000000n,
        500000000000000000n,
      ]);

      const tx = {
        to: rocketSwapRouterAddress,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: invertedCalldata,
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
        'Minimum tokens out exceeds ideal tokens out',
      );
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
      expect(approvalAttempt?.reason).toContain('should not send ETH value');
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

    it('should reject approval with unknown spender', () => {
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

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      const approvalAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.APPROVAL,
      );
      expect(approvalAttempt?.reason).toContain(
        'Approval spender is not a known LI.FI contract',
      );
    });

    it('should accept approval with Permit2 Proxy as spender', () => {
      const permit2ApproveCalldata = iface.encodeFunctionData('approve', [
        LIFI_PERMIT2_PROXY,
        1000000000000000000n,
      ]);

      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: permit2ApproveCalldata,
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

    it('should accept approval with checksummed LI.FI Diamond spender', () => {
      const checksummedDiamond = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
      const checksumApproveCalldata = iface.encodeFunctionData('approve', [
        checksummedDiamond,
        1000000000000000000n,
      ]);

      const tx = {
        to: rETHAddress,
        from: userAddress,
        value: '0x0',
        data: checksumApproveCalldata,
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

  describe('SWAP transactions', () => {
    // --- Happy paths ---

    it('should validate a direct Diamond swapTokensSingleV3ERC20ToNative with matching receiver', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0x0',
        data: diamondSwapCalldata,
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
      expect(result.detectedType).toBe(TransactionType.SWAP);
    });

    it('should validate a direct Diamond swapTokensSingleV3ERC20ToERC20 with matching receiver', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0x0',
        data: diamondSingleV3SwapCalldata,
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
      expect(result.detectedType).toBe(TransactionType.SWAP);
    });

    it('should validate Permit2 Proxy callDiamondWithPermit2 wrapping valid swap', () => {
      const tx = {
        to: LIFI_PERMIT2_PROXY,
        from: userAddress,
        value: '0x0',
        data: permit2WrappedSwapCalldata,
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
      expect(result.detectedType).toBe(TransactionType.SWAP);
    });

    it('should validate Permit2 Proxy callDiamondWithPermit2Witness wrapping valid swap', () => {
      const tx = {
        to: LIFI_PERMIT2_PROXY,
        from: userAddress,
        value: '0x0',
        data: permit2WitnessWrappedSwapCalldata,
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
      expect(result.detectedType).toBe(TransactionType.SWAP);
    });

    it('should validate Permit2 Proxy callDiamondWithEIP2612Signature wrapping valid swap', () => {
      const tx = {
        to: LIFI_PERMIT2_PROXY,
        from: userAddress,
        value: '0x0',
        data: eip2612WrappedSwapCalldata,
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
      expect(result.detectedType).toBe(TransactionType.SWAP);
    });

    // --- Rejections ---

    it('should reject SWAP to unknown contract', () => {
      const tx = {
        to: '0x0000000000000000000000000000000000000001',
        from: userAddress,
        value: '0x0',
        data: diamondSwapCalldata,
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain(
        'SWAP target is not a known LI.FI contract',
      );
    });

    it('should reject SWAP with no calldata', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0x0',
        data: '0x',
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain('SWAP transaction has no calldata');
    });

    it('should reject SWAP with unknown Diamond function selector', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0x0',
        data: '0xdeadbeef' + '00'.repeat(128),
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain(
        'Failed to parse LI.FI swap calldata',
      );
    });

    it('should reject SWAP with receiver not matching user address', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0x0',
        data: wrongReceiverSwapCalldata,
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain(
        'SWAP receiver does not match user address',
      );
    });

    it('should reject SWAP with ETH value', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0xde0b6b3a7640000',
        data: diamondSwapCalldata,
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain('SWAP should not send ETH value');
    });

    it('should reject SWAP from wrong user', () => {
      const wrongUser = '0x0000000000000000000000000000000000000001';
      const tx = {
        to: LIFI_DIAMOND,
        from: wrongUser,
        value: '0x0',
        data: diamondSwapCalldata,
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

    it('should reject SWAP on wrong network', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0x0',
        data: diamondSwapCalldata,
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

    // --- Permit2 Proxy-specific rejections ---

    it('should reject Permit2 Proxy SWAP with wrong receiver in inner calldata', () => {
      const tx = {
        to: LIFI_PERMIT2_PROXY,
        from: userAddress,
        value: '0x0',
        data: permit2WrongReceiverCalldata,
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain(
        'SWAP receiver does not match user address',
      );
    });

    it('should reject Permit2 Proxy SWAP with garbage inner calldata', () => {
      const garbageInnerCalldata = permit2ProxyIface.encodeFunctionData(
        'callDiamondWithPermit2',
        ['0xdeadbeef' + '00'.repeat(128), dummyPermit, dummySignature],
      );

      const tx = {
        to: LIFI_PERMIT2_PROXY,
        from: userAddress,
        value: '0x0',
        data: garbageInnerCalldata,
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain(
        'Failed to parse LI.FI swap calldata',
      );
    });

    it('should reject Permit2 Proxy target with unparseable outer calldata', () => {
      const tx = {
        to: LIFI_PERMIT2_PROXY,
        from: userAddress,
        value: '0x0',
        data: '0xffffffff' + '00'.repeat(64),
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
      const swapAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.SWAP,
      );
      expect(swapAttempt?.reason).toContain(
        'Failed to extract Diamond calldata from Permit2 Proxy',
      );
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

    it('should detect direct Diamond swap as SWAP', () => {
      const tx = {
        to: LIFI_DIAMOND,
        from: userAddress,
        value: '0x0',
        data: diamondSwapCalldata,
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
      expect(result.detectedType).toBe(TransactionType.SWAP);
    });

    it('should detect Permit2 Proxy swap as SWAP', () => {
      const tx = {
        to: LIFI_PERMIT2_PROXY,
        from: userAddress,
        value: '0x0',
        data: permit2WrappedSwapCalldata,
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
      expect(result.detectedType).toBe(TransactionType.SWAP);
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
