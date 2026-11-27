import { AccountMeta, Transaction } from '@solana/web3.js';

export type SolanaInstruction = {
  programId: string;
  data: Buffer;
  accounts: AccountMeta[];
};

export type DecodedSolanaTransaction = {
  feePayer: string | undefined;
  instructions: SolanaInstruction[];
};

export type DecodeResult =
  | { ok: true; tx: DecodedSolanaTransaction }
  | { ok: false; error: string };

/**
 * Decodes a hex-encoded legacy Solana transaction, signed or unsigned.
 */
export function decodeSolanaTransaction(hex: string): DecodeResult {
  try {
    const tx = Transaction.from(Buffer.from(hex, 'hex'));
    return {
      ok: true,
      tx: {
        feePayer: tx.feePayer?.toBase58(),
        instructions: tx.instructions.map((instruction) => ({
          programId: instruction.programId.toBase58(),
          data: instruction.data,
          accounts: instruction.keys.map((key) => ({
            pubkey: key.pubkey,
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function accountAt(
  instruction: SolanaInstruction,
  index: number,
): string | undefined {
  return instruction.accounts.at(index)?.pubkey.toBase58();
}
