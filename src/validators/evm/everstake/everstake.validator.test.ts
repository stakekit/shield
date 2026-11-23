import { ethers } from 'ethers';
import { Shield } from '../../../shield';
import { TransactionType, ValidationResult } from '../../../types';

const USER = '0x0a86e8c246a2d3e23ac48d2c7b53a5ce37e6e4bf';
const OTHER = '0x0000000000000000000000000000000000000001';

const MAINNET_POOL = '0xD523794C879D9eC028960a231F866758e405bE34';
const MAINNET_ACCOUNTING = '0x7a7f0b3c23C23a31cFcb0c44709be70d4D545c6e';
const HOODI_POOL = '0x7967AcFc9EB46cA2d20076B61B05e224F2d0B8b3';
const HOODI_ACCOUNTING = '0x6Cf2F03804b171ef9CAFC71e302CA0e08A3FDC28';

const STAKE_DATA =
  '0x3a29dbae0000000000000000000000000000000000000000000000000000000000000009';
// unstake(1.5 ETH, 10, 9)
const UNSTAKE_DATA =
  '0x76ec871c' +
  '00000000000000000000000000000000000000000000000014d1120d7b160000' +
  '000000000000000000000000000000000000000000000000000000000000000a' +
  '0000000000000000000000000000000000000000000000000000000000000009';
const WITHDRAW_DATA = '0x33986ffa';

const GAS = {
  nonce: 7,
  type: 2,
  maxFeePerGas: '0x06fc23ac00',
  maxPriorityFeePerGas: '0x3b9aca00',
};

/**
 * Unsigned transactions built by the Everstake module in stakekit-monorepo
 * (libs/chains/src/ethereum/eth-everstake-staking) for a 1.5 ETH amount.
 */
const FIXTURES = {
  'ethereum-eth-everstake-staking': {
    chainId: 1,
    pool: MAINNET_POOL,
    accounting: MAINNET_ACCOUNTING,
    STAKE: {
      from: USER,
      to: MAINNET_POOL,
      value: '1500000000000000000',
      gasLimit: '0x01d4c0',
      data: STAKE_DATA,
      ...GAS,
      chainId: 1,
    },
    UNSTAKE: {
      from: USER,
      to: MAINNET_POOL,
      value: '0',
      gasLimit: '0x0975e0',
      data: UNSTAKE_DATA,
      ...GAS,
      chainId: 1,
    },
    WITHDRAW: {
      from: USER,
      to: MAINNET_ACCOUNTING,
      value: '0',
      gasLimit: '0x01d4c0',
      data: WITHDRAW_DATA,
      ...GAS,
      chainId: 1,
    },
  },
  'ethereum-hoodi-eth-everstake-staking': {
    chainId: 560048,
    pool: HOODI_POOL,
    accounting: HOODI_ACCOUNTING,
    STAKE: {
      from: USER,
      to: HOODI_POOL,
      value: '1500000000000000000',
      gasLimit: '0x01d4c0',
      data: STAKE_DATA,
      ...GAS,
      chainId: 560048,
    },
    UNSTAKE: {
      from: USER,
      to: HOODI_POOL,
      value: '0',
      gasLimit: '0x0975e0',
      data: UNSTAKE_DATA,
      ...GAS,
      chainId: 560048,
    },
    WITHDRAW: {
      from: USER,
      to: HOODI_ACCOUNTING,
      value: '0',
      gasLimit: '0x01d4c0',
      data: WITHDRAW_DATA,
      ...GAS,
      chainId: 560048,
    },
  },
} as const;

const poolInterface = new ethers.Interface([
  'function stake(uint64 source) payable',
  'function unstake(uint256 value, uint16 allowedInterchangeNum, uint64 source) returns (uint256)',
]);

const encodeUnstake = (amount: bigint, interchanges: bigint, source: bigint) =>
  poolInterface.encodeFunctionData('unstake', [amount, interchanges, source]);

const shield = new Shield();

const omit = (tx: object, ...keys: string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(tx).filter(([key]) => !keys.includes(key)));

const attemptReason = (
  result: ValidationResult,
  type: TransactionType,
): string | undefined =>
  result.details?.attempts?.find((a) => a.type === type)?.reason;

describe.each(Object.entries(FIXTURES))(
  'EverstakeValidator: %s',
  (yieldId, f) => {
    const validate = (tx: object, userAddress: string = USER) =>
      shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(tx),
        userAddress,
      });

    const expectBlocked = (
      tx: object,
      type: TransactionType,
      reason: string,
    ) => {
      const result = validate(tx);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');
      expect(attemptReason(result, type)).toContain(reason);
    };

    it('is supported', () => {
      expect(shield.isSupported(yieldId)).toBe(true);
      expect(shield.getSupportedYieldIds()).toContain(yieldId);
    });

    describe('module fixtures', () => {
      it.each([
        TransactionType.STAKE,
        TransactionType.UNSTAKE,
        TransactionType.WITHDRAW,
      ] as const)('detects %s', (type) => {
        const result = validate(f[type]);
        expect(result.isValid).toBe(true);
        expect(result.detectedType).toBe(type);
      });

      it('accepts a legacy-gas stake with hex value and string chainId', () => {
        const rest = omit(f.STAKE, 'maxFeePerGas', 'maxPriorityFeePerGas');
        const tx = {
          ...rest,
          type: 0,
          gasPrice: '0x04a817c800',
          value: '0x14d1120d7b160000',
          chainId: String(f.chainId),
        };
        expect(validate(tx).detectedType).toBe(TransactionType.STAKE);
      });

      it('accepts a checksummed user address', () => {
        const result = validate(f.STAKE, ethers.getAddress(USER));
        expect(result.isValid).toBe(true);
      });
    });

    describe('common checks', () => {
      it('rejects a transaction from another address', () => {
        expectBlocked(
          { ...f.STAKE, from: OTHER },
          TransactionType.STAKE,
          'not from user address',
        );
      });

      it('rejects a transaction without from', () => {
        const tx = omit(f.UNSTAKE, 'from');
        expectBlocked(tx, TransactionType.UNSTAKE, 'not from user address');
      });

      it('rejects a transaction on another chain', () => {
        expectBlocked(
          { ...f.STAKE, chainId: 137 },
          TransactionType.STAKE,
          'must be on chain',
        );
      });

      it('rejects a transaction without chainId', () => {
        const tx = omit(f.WITHDRAW, 'chainId');
        expectBlocked(
          tx,
          TransactionType.WITHDRAW,
          'Failed to decode EVM transaction',
        );
      });

      it('rejects malformed JSON', () => {
        const result = shield.validate({
          yieldId,
          unsignedTransaction: '{not json',
          userAddress: USER,
        });
        expect(result.isValid).toBe(false);
        expect(attemptReason(result, TransactionType.STAKE)).toContain(
          'Failed to decode EVM transaction',
        );
      });

      it('rejects an unknown function on the pool', () => {
        const tx = {
          ...f.UNSTAKE,
          data:
            '0x095ea7b3' + OTHER.slice(2).padStart(64, '0') + 'f'.repeat(64),
        };
        const result = validate(tx);
        expect(result.isValid).toBe(false);
        expect(attemptReason(result, TransactionType.UNSTAKE)).toContain(
          'Failed to parse transaction data',
        );
      });

      it('rejects a pool function sent to the accounting contract', () => {
        expectBlocked(
          { ...f.UNSTAKE, to: f.accounting },
          TransactionType.WITHDRAW,
          'Failed to parse transaction data',
        );
      });
    });

    describe('STAKE', () => {
      it('rejects the wrong contract', () => {
        expectBlocked(
          { ...f.STAKE, to: OTHER },
          TransactionType.STAKE,
          'not to Everstake Pool contract',
        );
      });

      it('rejects a missing contract address', () => {
        expectBlocked(
          { ...f.STAKE, to: null },
          TransactionType.STAKE,
          'not to Everstake Pool contract',
        );
      });

      it.each(['0', undefined])('rejects value %s', (value) => {
        expectBlocked(
          { ...f.STAKE, value },
          TransactionType.STAKE,
          'Stake must send ETH value',
        );
      });

      it('rejects a different source', () => {
        const data = poolInterface.encodeFunctionData('stake', [1n]);
        expectBlocked(
          { ...f.STAKE, data },
          TransactionType.STAKE,
          'Invalid Everstake source',
        );
      });

      it('rejects appended calldata', () => {
        expectBlocked(
          { ...f.STAKE, data: f.STAKE.data + 'deadbeef' },
          TransactionType.STAKE,
          'calldata has been tampered',
        );
      });

      it('rejects unstake calldata with ETH value', () => {
        expectBlocked(
          { ...f.STAKE, data: UNSTAKE_DATA },
          TransactionType.STAKE,
          'Invalid method for staking',
        );
      });
    });

    describe('UNSTAKE', () => {
      it('rejects the wrong contract', () => {
        expectBlocked(
          { ...f.UNSTAKE, to: f.accounting },
          TransactionType.UNSTAKE,
          'not to Everstake Pool contract',
        );
      });

      it('rejects ETH value', () => {
        expectBlocked(
          { ...f.UNSTAKE, value: '1' },
          TransactionType.UNSTAKE,
          'Unstake should not send ETH value',
        );
      });

      it('rejects a zero amount', () => {
        expectBlocked(
          { ...f.UNSTAKE, data: encodeUnstake(0n, 10n, 9n) },
          TransactionType.UNSTAKE,
          'Unstake amount must be greater than zero',
        );
      });

      it.each([0n, 9n, 11n, 65535n])(
        'rejects allowedInterchangeNum %s',
        (interchanges) => {
          expectBlocked(
            { ...f.UNSTAKE, data: encodeUnstake(1n, interchanges, 9n) },
            TransactionType.UNSTAKE,
            'Invalid allowed interchange number',
          );
        },
      );

      it('rejects a different source', () => {
        expectBlocked(
          { ...f.UNSTAKE, data: encodeUnstake(1n, 10n, 0n) },
          TransactionType.UNSTAKE,
          'Invalid Everstake source',
        );
      });

      it('rejects an out-of-range uint16 interchange word', () => {
        const data = UNSTAKE_DATA.replace(
          '000000000000000000000000000000000000000000000000000000000000000a',
          '000000000000000000000000000000000000000000000000000000000001000a',
        );
        const result = validate({ ...f.UNSTAKE, data });
        expect(result.isValid).toBe(false);
      });

      it('rejects appended calldata', () => {
        expectBlocked(
          { ...f.UNSTAKE, data: f.UNSTAKE.data + '00' },
          TransactionType.UNSTAKE,
          'calldata has been tampered',
        );
      });

      it('rejects stake calldata without value', () => {
        expectBlocked(
          { ...f.UNSTAKE, data: STAKE_DATA },
          TransactionType.UNSTAKE,
          'Invalid method for unstaking',
        );
      });
    });

    describe('WITHDRAW', () => {
      it('rejects the wrong contract', () => {
        expectBlocked(
          { ...f.WITHDRAW, to: f.pool },
          TransactionType.WITHDRAW,
          'not to Everstake Accounting contract',
        );
      });

      it('rejects ETH value', () => {
        expectBlocked(
          { ...f.WITHDRAW, value: '0x1' },
          TransactionType.WITHDRAW,
          'Withdraw should not send ETH value',
        );
      });

      it('rejects appended calldata', () => {
        expectBlocked(
          { ...f.WITHDRAW, data: WITHDRAW_DATA + '0'.repeat(64) },
          TransactionType.WITHDRAW,
          'calldata has been tampered',
        );
      });

      it('rejects an unknown selector', () => {
        expectBlocked(
          { ...f.WITHDRAW, data: '0xdeadbeef' },
          TransactionType.WITHDRAW,
          'Failed to parse transaction data',
        );
      });
    });
  },
);

describe('EverstakeValidator: network isolation', () => {
  it('rejects a mainnet transaction under the Hoodi yield', () => {
    const result = shield.validate({
      yieldId: 'ethereum-hoodi-eth-everstake-staking',
      unsignedTransaction: JSON.stringify({
        ...FIXTURES['ethereum-eth-everstake-staking'].STAKE,
        chainId: 560048,
      }),
      userAddress: USER,
    });
    expect(result.isValid).toBe(false);
    expect(attemptReason(result, TransactionType.STAKE)).toContain(
      'not to Everstake Pool contract',
    );
  });
});
