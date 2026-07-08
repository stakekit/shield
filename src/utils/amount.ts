export const MAX_UINT256 = (1n << 256n) - 1n;

// Opt-in: undefined declared amount → skip (returns true).
export function matchesDeclaredAmount(
  calldataAmount: bigint,
  declared?: string,
): boolean {
  if (declared === undefined) return true;
  return calldataAmount === BigInt(declared);
}
