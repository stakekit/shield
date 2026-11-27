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

const INSTRUCTION_INDEX_LENGTH = 4;
// CreateAccountWithSeed: index (u32), base (32 bytes), seed length (u64),
// seed bytes, then lamports (u64), space (u64) and owner (32 bytes).
const CREATE_WITH_SEED_SEED_LENGTH_OFFSET = 36;
const CREATE_WITH_SEED_SEED_OFFSET = 44;

/**
 * Reads the u64 that follows the 4-byte instruction index, as in System
 * `Transfer` and Stake `Withdraw`. web3.js decoders return these lamports as
 * a `number`, which loses precision above 2^53.
 */
export function readU64AfterIndex(instruction: SolanaInstruction): bigint {
  return instruction.data.readBigUInt64LE(INSTRUCTION_INDEX_LENGTH);
}

/**
 * Reads the lamports of a System `CreateAccountWithSeed` exactly. The offset
 * is taken from the seed length, not the end of the data, because trailing
 * bytes are ignored when the instruction is decoded.
 */
export function readCreateWithSeedLamports(
  instruction: SolanaInstruction,
): bigint {
  const { data } = instruction;
  const seedLength = data.readUInt32LE(CREATE_WITH_SEED_SEED_LENGTH_OFFSET);
  return data.readBigUInt64LE(CREATE_WITH_SEED_SEED_OFFSET + seedLength);
}
