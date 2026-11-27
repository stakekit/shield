import {
  AccountMeta,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

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

export type AccountMismatch = {
  index: number;
  expected: string | null;
  actual: string | undefined;
};

/**
 * Compares an instruction's accounts to an expected list. `null` accepts any
 * account at that position. The account count must match exactly.
 */
export function findAccountMismatch(
  instruction: SolanaInstruction,
  expected: ReadonlyArray<string | null>,
): AccountMismatch | undefined {
  if (instruction.accounts.length !== expected.length) {
    return {
      index: -1,
      expected: `${expected.length} accounts`,
      actual: `${instruction.accounts.length} accounts`,
    };
  }
  for (const [index, address] of expected.entries()) {
    const actual = accountAt(instruction, index);
    if (address !== null && actual !== address) {
      return { index, expected: address, actual };
    }
  }
  return undefined;
}

export function toTransactionInstruction(
  instruction: SolanaInstruction,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts,
    data: instruction.data,
  });
}

export type Decoded<T> = { ok: true; value: T } | { ok: false; error: string };

/** Runs a web3.js instruction decoder, turning a throw into an error result. */
export function tryDecode<T>(decode: () => T): Decoded<T> {
  try {
    return { ok: true, value: decode() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
