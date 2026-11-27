import { PublicKey } from '@solana/web3.js';

export const MARINADE_PROGRAM_ID =
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD';
export const MARINADE_STATE = '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC';
export const MSOL_MINT = 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So';
export const LIQ_POOL_MSOL_LEG = '7GgPYjS5Dza89wV6FpZ23kUJRG5vbQ1GM25ezspYFSoE';

function marinadePda(seed: string): string {
  const [address] = PublicKey.findProgramAddressSync(
    [new PublicKey(MARINADE_STATE).toBuffer(), Buffer.from(seed)],
    new PublicKey(MARINADE_PROGRAM_ID),
  );
  return address.toBase58();
}

export const RESERVE_PDA = marinadePda('reserve');
export const MSOL_MINT_AUTHORITY_PDA = marinadePda('st_mint');
export const LIQ_POOL_MSOL_LEG_AUTHORITY_PDA = marinadePda(
  'liq_st_sol_authority',
);
export const LIQ_POOL_SOL_LEG_PDA = marinadePda('liq_sol');

/** First 8 bytes of sha256("global:<instruction name>"). */
export const MARINADE_DISCRIMINATORS = {
  deposit: Buffer.from('f223c68952e1f2b6', 'hex'),
  liquidUnstake: Buffer.from('1e1e77f0bfe30c10', 'hex'),
  orderUnstake: Buffer.from('61a7906b75be8024', 'hex'),
  claim: Buffer.from('3ec6d6c1d59f6cd2', 'hex'),
} as const;

export const MARINADE_TICKET_ACCOUNT_SPACE = 88n;

export const NATIVE_STAKE_AUTHORITY =
  'stWirqFCf2Uts1JBL1Jsd3r6VBWhgnpdPxCTe1MFjrq';
export const NATIVE_BENEFICIARY = 'opNS8ENpEMWdXcJUgJCsJTDp7arTXayoBEeBUg6UezP';
export const NATIVE_PREPARE_FOR_REVOKE_COST_LAMPORTS = 3_000_000n;
