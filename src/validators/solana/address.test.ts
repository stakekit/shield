import { Keypair, PublicKey, StakeProgram } from '@solana/web3.js';
import { associatedTokenAddress, createWithSeed } from './address';

describe('createWithSeed', () => {
  it('matches the web3.js derivation', async () => {
    const base = Keypair.generate().publicKey;
    const expected = await PublicKey.createWithSeed(
      base,
      'msol-fixture',
      StakeProgram.programId,
    );

    expect(
      createWithSeed(
        base.toBase58(),
        'msol-fixture',
        StakeProgram.programId.toBase58(),
      ),
    ).toBe(expected.toBase58());
  });
});

describe('associatedTokenAddress', () => {
  it('derives the owner token account for a mint', () => {
    expect(
      associatedTokenAddress(
        '29LDedMM8bYERotXSvUhBaXeWWdgi5kqwu4YBxAPLamy',
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      ),
    ).toBe('3rBL1rHQZmv3doUwXqr5v5iY4fP5TGXZR3yFJi7jP6yL');
  });
});
