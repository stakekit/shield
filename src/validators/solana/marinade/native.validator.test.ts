import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { Shield } from '../../../shield';
import { ActionArguments, TransactionType } from '../../../types';
import {
  FIXTURE_RECEIVER,
  FIXTURE_USER,
  NATIVE_FIXTURES,
} from './marinade.fixtures';

const yieldId = 'solana-sol-marinade-native-max-yield-staking';
const shield = new Shield();
const randomAddress = (): PublicKey => Keypair.generate().publicKey;

const STAKER_OFFSET = 4;
const WITHDRAWER_OFFSET = 36;
const LOCKUP_EPOCH_OFFSET = 76;
const LAMPORTS_OFFSET = 4;

function validate(
  unsignedTransaction: string,
  args?: ActionArguments,
  userAddress = FIXTURE_USER,
) {
  return shield.validate({ yieldId, unsignedTransaction, userAddress, args });
}

function mutate(hex: string, change: (tx: Transaction) => void): string {
  const tx = Transaction.from(Buffer.from(hex, 'hex'));
  change(tx);
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('hex');
}

function replaceAccount(instructionIndex: number, index: number) {
  return (tx: Transaction) => {
    const keys = tx.instructions[instructionIndex].keys;
    keys[index] = { ...keys[index], pubkey: randomAddress() };
  };
}

function replaceData(
  instructionIndex: number,
  change: (data: Buffer) => Buffer,
) {
  return (tx: Transaction) => {
    const instruction = tx.instructions[instructionIndex];
    instruction.data = change(Buffer.from(instruction.data));
  };
}

function writeAddress(
  instructionIndex: number,
  offset: number,
  address: string,
) {
  return replaceData(instructionIndex, (data) => {
    new PublicKey(address).toBuffer().copy(data, offset);
    return data;
  });
}

function writeLamports(instructionIndex: number, lamports: bigint) {
  return replaceData(instructionIndex, (data) => {
    data.writeBigUInt64LE(lamports, LAMPORTS_OFFSET);
    return data;
  });
}

function withMemo(memo: string): string {
  return mutate(
    NATIVE_FIXTURES.unstake,
    replaceData(1, () => Buffer.from(memo, 'utf8')),
  );
}

describe('MarinadeNativeValidator via Shield', () => {
  it('is registered for the Marinade Native yield', () => {
    expect(shield.isSupported(yieldId)).toBe(true);
  });

  describe.each([
    ['stake', TransactionType.STAKE, undefined],
    ['unstake', TransactionType.UNSTAKE, undefined],
    ['withdraw', TransactionType.WITHDRAW, undefined],
    [
      'withdrawToReceiver',
      TransactionType.WITHDRAW,
      { receiverAddress: FIXTURE_RECEIVER },
    ],
  ] as const)('%s fixture', (name, expectedType, args) => {
    const fixture = NATIVE_FIXTURES[name];

    it(`is accepted as ${expectedType}`, () => {
      const result = validate(fixture, args);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(expectedType);
    });

    it('is rejected for a different user', () => {
      expect(validate(fixture, args, randomAddress().toBase58()).isValid).toBe(
        false,
      );
    });

    it('is rejected when the fee payer is changed', () => {
      const tampered = mutate(fixture, (tx) => {
        tx.feePayer = randomAddress();
      });

      expect(validate(tampered, args).isValid).toBe(false);
    });

    it('is rejected with a SOL transfer appended', () => {
      const tampered = mutate(fixture, (tx) => {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(FIXTURE_USER),
            toPubkey: randomAddress(),
            lamports: 1,
          }),
        );
      });

      expect(validate(tampered, args).isValid).toBe(false);
    });

    it('is rejected when the first instruction targets another program', () => {
      const tampered = mutate(fixture, (tx) => {
        tx.instructions[0].programId = randomAddress();
      });

      expect(validate(tampered, args).isValid).toBe(false);
    });
  });

  describe('STAKE', () => {
    it.each([
      ['staker is the user', writeAddress(1, STAKER_OFFSET, FIXTURE_USER)],
      [
        'withdrawer is not the user',
        writeAddress(1, WITHDRAWER_OFFSET, FIXTURE_RECEIVER),
      ],
      [
        'lockup epoch is set',
        replaceData(1, (data) => {
          data.writeBigUInt64LE(1n, LOCKUP_EPOCH_OFFSET);
          return data;
        }),
      ],
      ['initialized stake account differs', replaceAccount(1, 0)],
      ['created account differs from its seed', replaceAccount(0, 1)],
      [
        'created account is owned by the System program',
        replaceData(0, (data) => {
          Buffer.alloc(32).copy(data, data.length - 32);
          return data;
        }),
      ],
      [
        'Initialize has another instruction type',
        replaceData(1, (data) => {
          data.writeUInt32LE(5, 0);
          return data;
        }),
      ],
    ])('rejects when the %s', (_label, change) => {
      expect(validate(mutate(NATIVE_FIXTURES.stake, change)).isValid).toBe(
        false,
      );
    });
  });

  describe('UNSTAKE', () => {
    it.each([
      ['fee is one lamport short', writeLamports(0, 2_999_999n)],
      ['fee is one lamport over', writeLamports(0, 3_000_001n)],
      ['fee goes to another account', replaceAccount(0, 1)],
      [
        'memo goes to another program',
        (tx: Transaction) => {
          tx.instructions[1].programId = randomAddress();
        },
      ],
      [
        'memo requires a signer',
        (tx: Transaction) => {
          tx.instructions[1].keys.push({
            pubkey: new PublicKey(FIXTURE_USER),
            isSigner: true,
            isWritable: false,
          });
        },
      ],
    ])('rejects when the %s', (_label, change) => {
      expect(validate(mutate(NATIVE_FIXTURES.unstake, change)).isValid).toBe(
        false,
      );
    });

    it.each([
      [
        'another user',
        `{"PrepareForRevoke":{"user":"${FIXTURE_RECEIVER}","amount":"1000000000"}}`,
      ],
      [
        'a zero amount',
        `{"PrepareForRevoke":{"user":"${FIXTURE_USER}","amount":"0"}}`,
      ],
      [
        'a negative amount',
        `{"PrepareForRevoke":{"user":"${FIXTURE_USER}","amount":"-1"}}`,
      ],
      [
        'a fractional amount',
        `{"PrepareForRevoke":{"user":"${FIXTURE_USER}","amount":"1.5"}}`,
      ],
      [
        'a numeric amount',
        `{"PrepareForRevoke":{"user":"${FIXTURE_USER}","amount":1}}`,
      ],
      ['no PrepareForRevoke', `{"user":"${FIXTURE_USER}"}`],
      ['an array', '[]'],
      ['null', 'null'],
      ['invalid JSON', 'PrepareForRevoke'],
    ])('rejects a memo with %s', (_label, memo) => {
      expect(validate(withMemo(memo)).isValid).toBe(false);
    });

    it.each([
      ['without an amount', `{"PrepareForRevoke":{"user":"${FIXTURE_USER}"}}`],
      [
        'with extra fields',
        `{"PrepareForRevoke":{"user":"${FIXTURE_USER}","amount":"5","note":"x"},"version":1}`,
      ],
    ])('accepts a memo %s', (_label, memo) => {
      expect(validate(withMemo(memo)).isValid).toBe(true);
    });
  });

  describe('WITHDRAW', () => {
    it('rejects a payout to a receiver that was not declared', () => {
      expect(validate(NATIVE_FIXTURES.withdrawToReceiver).isValid).toBe(false);
    });

    it('rejects a payout to the user when another receiver is declared', () => {
      expect(
        validate(NATIVE_FIXTURES.withdraw, {
          receiverAddress: FIXTURE_RECEIVER,
        }).isValid,
      ).toBe(false);
    });

    it.each([
      ['authority is not the user', replaceAccount(0, 4)],
      ['clock sysvar is swapped', replaceAccount(0, 2)],
      ['amount is zero', writeLamports(0, 0n)],
      [
        'instruction is not a withdraw',
        replaceData(0, (data) => {
          data.writeUInt32LE(5, 0);
          return data;
        }),
      ],
    ])('rejects when the %s', (_label, change) => {
      expect(validate(mutate(NATIVE_FIXTURES.withdraw, change)).isValid).toBe(
        false,
      );
    });
  });
});

describe('MarinadeNativeValidator declared amount', () => {
  it.each([
    ['stake', '2000000000'],
    ['unstake', '1000000000'],
    ['withdraw', '1000000000'],
  ] as const)('accepts %s when the amount matches', (name, amount) => {
    expect(validate(NATIVE_FIXTURES[name], { amount }).isValid).toBe(true);
  });

  it.each([
    ['stake', '1999999999'],
    ['unstake', '1'],
    ['withdraw', '1000000001'],
  ] as const)('rejects %s when the amount is %s', (name, amount) => {
    expect(validate(NATIVE_FIXTURES[name], { amount }).isValid).toBe(false);
  });

  it('rejects an unstake whose memo has no amount when one is declared', () => {
    const memo = `{"PrepareForRevoke":{"user":"${FIXTURE_USER}"}}`;

    expect(validate(withMemo(memo), { amount: '1000000000' }).isValid).toBe(
      false,
    );
  });

  it.each([['1.5'], ['-1'], ['abc']])(
    'rejects a declared amount of %p',
    (amount) => {
      expect(validate(NATIVE_FIXTURES.stake, { amount }).isValid).toBe(false);
    },
  );
});

describe('MarinadeNativeValidator amounts above 2^53 lamports', () => {
  const unsafe = 9_007_199_254_740_993n;
  const CREATE_WITH_SEED_LAMPORTS_FROM_END = 48;

  const withdrawUnsafe = mutate(
    NATIVE_FIXTURES.withdraw,
    writeLamports(0, unsafe),
  );
  const stakeUnsafe = mutate(
    NATIVE_FIXTURES.stake,
    replaceData(0, (data) => {
      data.writeBigUInt64LE(
        unsafe,
        data.length - CREATE_WITH_SEED_LAMPORTS_FROM_END,
      );
      return data;
    }),
  );

  it.each([
    ['withdraw', withdrawUnsafe],
    ['stake', stakeUnsafe],
  ])('accepts %s with the exact declared amount', (_name, tx) => {
    expect(validate(tx, { amount: unsafe.toString() }).isValid).toBe(true);
  });

  it.each([
    ['withdraw', withdrawUnsafe],
    ['stake', stakeUnsafe],
  ])('rejects %s with a declared amount one lamport lower', (_name, tx) => {
    expect(validate(tx, { amount: (unsafe - 1n).toString() }).isValid).toBe(
      false,
    );
  });

  it('compares the memo amount as an integer', () => {
    expect(
      validate(NATIVE_FIXTURES.unstake, { amount: '01000000000' }).isValid,
    ).toBe(true);
  });
});
