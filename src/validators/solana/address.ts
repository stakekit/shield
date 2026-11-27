import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';

export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
export const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const ASSOCIATED_TOKEN_PROGRAM_ID =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const SYSVAR_CLOCK_ID = 'SysvarC1ock11111111111111111111111111111111';
export const SYSVAR_RENT_ID = 'SysvarRent111111111111111111111111111111111';
export const SYSVAR_STAKE_HISTORY_ID =
  'SysvarStakeHistory1111111111111111111111111';

/**
 * Synchronous equivalent of `PublicKey.createWithSeed`.
 */
export function createWithSeed(
  base: string,
  seed: string,
  programId: string,
): string {
  const digest = createHash('sha256')
    .update(new PublicKey(base).toBuffer())
    .update(Buffer.from(seed, 'utf8'))
    .update(new PublicKey(programId).toBuffer())
    .digest();
  return new PublicKey(digest).toBase58();
}

export function associatedTokenAddress(owner: string, mint: string): string {
  const [address] = PublicKey.findProgramAddressSync(
    [
      new PublicKey(owner).toBuffer(),
      new PublicKey(TOKEN_PROGRAM_ID).toBuffer(),
      new PublicKey(mint).toBuffer(),
    ],
    new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
  );
  return address.toBase58();
}
