import {
  MAX_UINT256,
  matchesDeclaredAmount,
  matchesDeclaredAmountWithinMargin,
  getErc4626RedeemMargin,
} from './amount';

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

  it('throws on a non-integer declared string (defense-in-depth: unreachable via schema pattern + validator guard, which reject non-digit amounts first)', () => {
    expect(() => matchesDeclaredAmount(1000000n, '1.5')).toThrow();
    expect(() => matchesDeclaredAmount(1000000n, 'abc')).toThrow();
  });
});

describe('matchesDeclaredAmountWithinMargin', () => {
  const DECLARED = '1000';
  const MARGIN = '10';

  it('returns true on exact match', () => {
    expect(matchesDeclaredAmountWithinMargin(1000n, DECLARED, MARGIN)).toBe(
      true,
    );
  });

  it('returns true when calldata is within margin above declared (snap-up)', () => {
    expect(matchesDeclaredAmountWithinMargin(1005n, DECLARED, MARGIN)).toBe(
      true,
    );
  });

  it('returns true when calldata is within margin below declared (snap-down)', () => {
    expect(matchesDeclaredAmountWithinMargin(995n, DECLARED, MARGIN)).toBe(
      true,
    );
  });

  it('returns false when outside margin', () => {
    expect(matchesDeclaredAmountWithinMargin(1011n, DECLARED, MARGIN)).toBe(
      false,
    );
  });

  it('returns true when declared is undefined (opt-in skip)', () => {
    expect(matchesDeclaredAmountWithinMargin(999999n, undefined, MARGIN)).toBe(
      true,
    );
  });

  it('throws on non-integer declared string', () => {
    expect(() =>
      matchesDeclaredAmountWithinMargin(1000n, '1.5', MARGIN),
    ).toThrow();
  });
});

describe('getErc4626RedeemMargin', () => {
  it('returns 10 when useDecimalGapMargin is false', () => {
    expect(
      getErc4626RedeemMargin({
        useDecimalGapMargin: false,
        inputTokenDecimals: 6,
        vaultTokenDecimals: 18,
      }),
    ).toBe('10');
  });

  it('returns 10 when decimals are missing even with useDecimalGapMargin', () => {
    expect(getErc4626RedeemMargin({ useDecimalGapMargin: true })).toBe('10');
  });

  it('returns 10^(abs(diff)+1) when gap margin + decimals (6 vs 18 → 10^13)', () => {
    expect(
      getErc4626RedeemMargin({
        useDecimalGapMargin: true,
        inputTokenDecimals: 6,
        vaultTokenDecimals: 18,
      }),
    ).toBe((10n ** 13n).toString());
  });
  
  it('returns 10 for equal decimals with gap margin (diff 0 → 10^1)', () => {
    expect(
      getErc4626RedeemMargin({
        useDecimalGapMargin: true,
        inputTokenDecimals: 18,
        vaultTokenDecimals: 18,
      }),
    ).toBe('10');
  });
});