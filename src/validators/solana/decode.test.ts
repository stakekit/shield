import { accountAt, decodeSolanaTransaction } from './decode';
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
