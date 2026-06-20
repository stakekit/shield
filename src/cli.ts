#!/usr/bin/env node
import { handleJsonRequest, MAX_INPUT_SIZE } from './json';

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    // Don't set encoding - keep as Buffer for accurate byte counting
    process.stdin.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length; // Buffer.length is actual bytes
      // SECURITY: Enforce size limit during streaming
      if (totalBytes > MAX_INPUT_SIZE) {
        reject(new Error('Input exceeds maximum size'));
        return;
      }
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      const data = Buffer.concat(chunks).toString('utf8');
      resolve(data);
    });

    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const output = handleJsonRequest(input);
    // Wait for stdout to flush before exiting. process.exit() drops any
    // unflushed buffer when stdout is a pipe, truncating large responses
    // (e.g. getSupportedYieldIds) at the ~64KB pipe-buffer boundary.
    process.stdout.write(output + '\n', () => process.exit(0));
  } catch (error) {
    // SECURITY: Output valid JSON even on catastrophic failure
    const errorResponse = {
      ok: false,
      apiVersion: '1.0',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process request',
      },
      meta: { requestHash: 'unavailable' },
    };
    process.stdin.destroy();
    process.stdout.write(JSON.stringify(errorResponse) + '\n', () =>
      process.exit(1),
    );
  }
}

void main();
