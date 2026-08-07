export const MAX_UINT256 = (1n << 256n) - 1n;

// Opt-in: undefined declared amount → skip (returns true).
export function matchesDeclaredAmount(
  calldataAmount: bigint,
  declared?: string,
): boolean {
  if (declared === undefined) return true;
  return calldataAmount === BigInt(declared);
}

/**
 * Opt-in bounded match for redeem clamp: pass if |calldata - declared| <= margin.
 * Non-digit `declared` throws via BigInt (same as matchesDeclaredAmount); callers
 * must reject non-digits before calling.
 */
export function matchesDeclaredAmountWithinMargin(
  calldataAmount: bigint,
  declared: string | undefined,
  margin: string,
): boolean {
  if (declared === undefined) return true;
  const declaredAmount = BigInt(declared);
  const delta =
    calldataAmount >= declaredAmount
      ? calldataAmount - declaredAmount
      : declaredAmount - calldataAmount;
  return delta <= BigInt(margin);
}

/**
 * Replicates monorepo getRedeemMargin / getErc4626ExitMargin (without kiln address list).
 * Missing feeConfigurationId OR missing decimals → "10".
 */
export function getErc4626RedeemMargin(input: {
  feeConfigurationId?: string;
  inputTokenDecimals?: number;
  vaultTokenDecimals?: number;
}): string {
  if (
    input.feeConfigurationId === undefined ||
    input.inputTokenDecimals === undefined ||
    input.vaultTokenDecimals === undefined
  ) {
    return '10';
  }
  const difference = Math.abs(
    input.inputTokenDecimals - input.vaultTokenDecimals,
  );
  return (10n ** BigInt(difference + 1)).toString();
}
