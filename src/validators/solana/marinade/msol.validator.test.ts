import { createHash } from 'node:crypto';
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { Shield } from '../../../shield';
import { TransactionType } from '../../../types';
import { MARINADE_DISCRIMINATORS } from './constants';
import {
  FIXTURE_RECEIVER,
  FIXTURE_USER,
  MSOL_FIXTURES,
} from './marinade.fixtures';

const yieldId = 'solana-sol-marinade-staking';
const shield = new Shield();
const randomAddress = (): PublicKey => Keypair.generate().publicKey;

function validate(unsignedTransaction: string, userAddress = FIXTURE_USER) {
  return shield.validate({ yieldId, unsignedTransaction, userAddress });
}

function mutate(hex: string, change: (tx: Transaction) => void): string {
  const tx = Transaction.from(Buffer.from(hex, 'hex'));
  change(tx);
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString('hex');
}

function replaceAccount(index: number, instructionIndex = 0) {
  return (tx: Transaction) => {
    const keys = tx.instructions[instructionIndex].keys;
    keys[index] = { ...keys[index], pubkey: randomAddress() };
  };
}

function replaceData(change: (data: Buffer) => Buffer, instructionIndex = 0) {
  return (tx: Transaction) => {
    const instruction = tx.instructions[instructionIndex];
    instruction.data = change(Buffer.from(instruction.data));
  };
}

describe('MarinadeMsolValidator via Shield', () => {
  it('is registered for the mSOL yield', () => {
    expect(shield.isSupported(yieldId)).toBe(true);
  });

  it.each([
    ['deposit', 'deposit'],
    ['liquidUnstake', 'liquid_unstake'],
    ['orderUnstake', 'order_unstake'],
    ['claim', 'claim'],
  ] as const)('pins the %s Anchor discriminator', (key, name) => {
    const expected = createHash('sha256')
      .update(`global:${name}`)
      .digest()
      .subarray(0, 8);

    expect(MARINADE_DISCRIMINATORS[key].equals(expected)).toBe(true);
  });

  describe.each([
    ['createAccount', TransactionType.CREATE_ACCOUNT],
    ['stake', TransactionType.STAKE],
    ['unstakeInstant', TransactionType.UNSTAKE],
    ['unstakeDelayed', TransactionType.UNSTAKE],
    ['withdraw', TransactionType.WITHDRAW],
  ] as const)('%s fixture', (name, expectedType) => {
    const fixture = MSOL_FIXTURES[name];

    it(`is accepted as ${expectedType}`, () => {
      const result = validate(fixture);

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(expectedType);
    });

    it('is rejected for a different user', () => {
      expect(validate(fixture, randomAddress().toBase58()).isValid).toBe(false);
    });

    it('is rejected when the fee payer is changed', () => {
      const tampered = mutate(fixture, (tx) => {
        tx.feePayer = randomAddress();
      });

      expect(validate(tampered).isValid).toBe(false);
    });

    it('is rejected with a compute budget instruction prepended', () => {
      const tampered = mutate(fixture, (tx) => {
        tx.instructions.unshift(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        );
      });

      expect(validate(tampered).isValid).toBe(false);
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

      expect(validate(tampered).isValid).toBe(false);
    });

    it('is rejected when the last instruction targets another program', () => {
      const tampered = mutate(fixture, (tx) => {
        tx.instructions[tx.instructions.length - 1].programId = randomAddress();
      });

      expect(validate(tampered).isValid).toBe(false);
    });
  });

  describe('Marinade instruction data', () => {
    it.each([
      ['stake', 0],
      ['unstakeInstant', 0],
      ['unstakeDelayed', 1],
      ['withdraw', 0],
    ] as const)('rejects %s with a flipped discriminator', (name, index) => {
      const tampered = mutate(
        MSOL_FIXTURES[name],
        replaceData((data) => {
          data[0] ^= 0xff;
          return data;
        }, index),
      );

      expect(validate(tampered).isValid).toBe(false);
    });

    it.each([
      ['stake', 0],
      ['unstakeInstant', 0],
      ['unstakeDelayed', 1],
    ] as const)('rejects %s with a zero amount', (name, index) => {
      const tampered = mutate(
        MSOL_FIXTURES[name],
        replaceData((data) => {
          data.writeBigUInt64LE(0n, 8);
          return data;
        }, index),
      );

      expect(validate(tampered).isValid).toBe(false);
    });

    it.each([
      ['stake', 0, 8],
      ['unstakeInstant', 0, 12],
      ['unstakeDelayed', 1, 8],
      ['withdraw', 0, 4],
    ] as const)('rejects %s with data truncated', (name, index, length) => {
      const tampered = mutate(
        MSOL_FIXTURES[name],
        replaceData((data) => data.subarray(0, length), index),
      );

      expect(validate(tampered).isValid).toBe(false);
    });

    it('rejects a claim with trailing data', () => {
      const tampered = mutate(
        MSOL_FIXTURES.withdraw,
        replaceData((data) => Buffer.concat([data, Buffer.alloc(8)])),
      );

      expect(validate(tampered).isValid).toBe(false);
    });
  });

  describe('accounts', () => {
    it.each([
      ['createAccount ATA', 'createAccount', 1, 0],
      ['createAccount owner', 'createAccount', 2, 0],
      ['createAccount mint', 'createAccount', 3, 0],
      ['stake state', 'stake', 0, 0],
      ['stake liquidity pool SOL leg', 'stake', 2, 0],
      ['stake reserve', 'stake', 5, 0],
      ['stake mSOL recipient', 'stake', 7, 0],
      ['stake mint authority', 'stake', 8, 0],
      ['instant unstake burn account', 'unstakeInstant', 5, 0],
      ['instant unstake SOL receiver', 'unstakeInstant', 7, 0],
      ['delayed unstake burn account', 'unstakeDelayed', 2, 1],
      ['delayed unstake ticket', 'unstakeDelayed', 4, 1],
      ['delayed unstake ticket creation', 'unstakeDelayed', 1, 0],
      ['withdraw reserve', 'withdraw', 1, 0],
      ['withdraw receiver', 'withdraw', 3, 0],
    ] as const)('rejects a swapped %s', (_label, name, account, index) => {
      const tampered = mutate(
        MSOL_FIXTURES[name],
        replaceAccount(account, index),
      );

      expect(validate(tampered).isValid).toBe(false);
    });

    it('does not pin the treasury account on instant unstake', () => {
      const tampered = mutate(MSOL_FIXTURES.unstakeInstant, replaceAccount(4));

      expect(validate(tampered).isValid).toBe(true);
    });

    it('rejects a delayed unstake ticket owned by another program', () => {
      const tampered = mutate(
        MSOL_FIXTURES.unstakeDelayed,
        replaceData((data) => {
          randomAddress()
            .toBuffer()
            .copy(data, data.length - 32);
          return data;
        }, 0),
      );

      expect(validate(tampered).isValid).toBe(false);
    });

    it('rejects a delayed unstake ticket funded above its rent', () => {
      const tampered = mutate(
        MSOL_FIXTURES.unstakeDelayed,
        replaceData((data) => {
          data.writeBigUInt64LE(100_000_000_000n, data.length - 48);
          return data;
        }, 0),
      );

      expect(validate(tampered).isValid).toBe(false);
    });

    it('accepts a delayed unstake ticket funded below the current rent', () => {
      const tampered = mutate(
        MSOL_FIXTURES.unstakeDelayed,
        replaceData((data) => {
          data.writeBigUInt64LE(1_000_000n, data.length - 48);
          return data;
        }, 0),
      );

      expect(validate(tampered).isValid).toBe(true);
    });

    it('rejects a delayed unstake ticket with the wrong size', () => {
      const tampered = mutate(
        MSOL_FIXTURES.unstakeDelayed,
        replaceData((data) => {
          data.writeBigUInt64LE(1000n, data.length - 40);
          return data;
        }, 0),
      );

      expect(validate(tampered).isValid).toBe(false);
    });

    it('rejects a withdraw paying another receiver even when one is declared', () => {
      const tampered = mutate(MSOL_FIXTURES.withdraw, (tx) => {
        const keys = tx.instructions[0].keys;
        keys[3] = { ...keys[3], pubkey: new PublicKey(FIXTURE_RECEIVER) };
      });

      const result = shield.validate({
        yieldId,
        unsignedTransaction: tampered,
        userAddress: FIXTURE_USER,
        args: { receiverAddress: FIXTURE_RECEIVER },
      });

      expect(result.isValid).toBe(false);
    });

    it('accepts a withdraw paying the user when another receiver is declared', () => {
      const result = shield.validate({
        yieldId,
        unsignedTransaction: MSOL_FIXTURES.withdraw,
        userAddress: FIXTURE_USER,
        args: { receiverAddress: FIXTURE_RECEIVER },
      });

      expect(result.isValid).toBe(true);
    });

    it('rejects an instruction with an extra account', () => {
      const tampered = mutate(MSOL_FIXTURES.stake, (tx) => {
        tx.instructions[0].keys.push({
          pubkey: randomAddress(),
          isSigner: false,
          isWritable: true,
        });
      });

      expect(validate(tampered).isValid).toBe(false);
    });
  });
});

describe('MarinadeMsolValidator declared amount', () => {
  function validateWithAmount(unsignedTransaction: string, amount: string) {
    return shield.validate({
      yieldId,
      unsignedTransaction,
      userAddress: FIXTURE_USER,
      args: { amount },
    });
  }

  it.each([
    ['stake', '1000000000'],
    ['unstakeInstant', '500000000'],
    ['unstakeDelayed', '500000000'],
  ] as const)('accepts %s when the amount matches', (name, amount) => {
    expect(validateWithAmount(MSOL_FIXTURES[name], amount).isValid).toBe(true);
  });

  it.each([
    ['stake', '999999999'],
    ['stake', '1'],
    ['unstakeInstant', '500000001'],
    ['unstakeDelayed', '499999999'],
  ] as const)('rejects %s when the amount is %s', (name, amount) => {
    expect(validateWithAmount(MSOL_FIXTURES[name], amount).isValid).toBe(false);
  });

  it.each([['1.5'], ['-1'], ['0x10'], ['1e9']])(
    'rejects a declared amount of %p',
    (amount) => {
      expect(validateWithAmount(MSOL_FIXTURES.stake, amount).isValid).toBe(
        false,
      );
    },
  );

  it.each([['createAccount'], ['withdraw']] as const)(
    'ignores the declared amount on %s, which carries none',
    (name) => {
      expect(validateWithAmount(MSOL_FIXTURES[name], '1').isValid).toBe(true);
    },
  );
});
