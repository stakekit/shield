import {
  accountAt,
  decodeSolanaTransaction,
  findAccountMismatch,
} from './decode';
import { FIXTURE_USER, MSOL_FIXTURES } from './marinade/marinade.fixtures';

describe('decodeSolanaTransaction', () => {
  it('returns the fee payer and instructions of an unsigned transaction', () => {
    const result = decodeSolanaTransaction(MSOL_FIXTURES.unstakeDelayed);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tx.feePayer).toBe(FIXTURE_USER);
    expect(result.tx.instructions).toHaveLength(2);
    expect(result.tx.instructions[0].programId).toBe(
      '11111111111111111111111111111111',
    );
  });

  it.each([['zz'], [''], ['00']])('rejects undecodable input %p', (hex) => {
    const result = decodeSolanaTransaction(hex);

    expect(result.ok).toBe(false);
  });
});

describe('accountAt', () => {
  it('returns the base58 account at an index, or undefined past the end', () => {
    const result = decodeSolanaTransaction(MSOL_FIXTURES.stake);
    if (!result.ok) throw new Error(result.error);
    const deposit = result.tx.instructions[0];

    expect(accountAt(deposit, 6)).toBe(FIXTURE_USER);
    expect(accountAt(deposit, 11)).toBeUndefined();
  });
});

describe('findAccountMismatch', () => {
  const result = decodeSolanaTransaction(MSOL_FIXTURES.withdraw);
  if (!result.ok) throw new Error(result.error);
  const claim = result.tx.instructions[0];
  const accounts = claim.accounts.map((account) => account.pubkey.toBase58());

  it('accepts an exact match and null wildcards', () => {
    expect(findAccountMismatch(claim, accounts)).toBeUndefined();
    expect(
      findAccountMismatch(claim, [null, null, null, null, null, null]),
    ).toBeUndefined();
  });

  it('reports the first differing account', () => {
    const expected = [...accounts];
    expected[3] = FIXTURE_USER.replace('2', '3');

    expect(findAccountMismatch(claim, expected)?.index).toBe(3);
  });

  it('reports a different account count', () => {
    expect(findAccountMismatch(claim, accounts.slice(1))?.index).toBe(-1);
  });
});
