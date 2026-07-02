import { MAX_UINT256, matchesDeclaredAmount } from './amount';

describe('MAX_UINT256', () => {
  it('equals 2^256 - 1', () => {
    expect(MAX_UINT256).toBe(2n ** 256n - 1n);
  });
});

describe('matchesDeclaredAmount', () => {
  const DECLARED = '1000000'; // 1 USDC (6 decimals), wei

  it('returns true on exact match', () => {
    expect(matchesDeclaredAmount(1000000n, DECLARED)).toBe(true);
  });

  it('returns false when calldata amount is one above declared', () => {
    expect(matchesDeclaredAmount(1000001n, DECLARED)).toBe(false);
  });

  it('returns false when calldata amount is one below declared', () => {
    expect(matchesDeclaredAmount(999999n, DECLARED)).toBe(false);
  });

  it('returns false on gross inflation', () => {
    expect(matchesDeclaredAmount(1000000000000n, DECLARED)).toBe(false);
  });

  it('returns true when declared is undefined (opt-in skip)', () => {
    expect(matchesDeclaredAmount(123456789n, undefined)).toBe(true);
  });

  it('matches maxUint256 against a declared maxUint256 (sanctioned infinite)', () => {
    expect(matchesDeclaredAmount(MAX_UINT256, MAX_UINT256.toString())).toBe(
      true,
    );
  });

  it('rejects maxUint256 against a finite declared amount', () => {
    expect(matchesDeclaredAmount(MAX_UINT256, DECLARED)).toBe(false);
  });

  it('matches zero against declared "0"', () => {
    expect(matchesDeclaredAmount(0n, '0')).toBe(true);
  });

  it('throws on a malformed declared string (fail-safe: Shield.validate catches per-type throws)', () => {
    expect(() => matchesDeclaredAmount(1000000n, '1.5')).toThrow();
    expect(() => matchesDeclaredAmount(1000000n, 'abc')).toThrow();
  });
});
