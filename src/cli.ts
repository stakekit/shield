#!/usr/bin/env node
import { handleJsonRequest } from './json';

const MAX_INPUT_SIZE = 100 * 1024; // 100KB

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      data += chunk;
      // SECURITY: Enforce size limit during streaming
      if (data.length > MAX_INPUT_SIZE) {
        reject(new Error('Input exceeds maximum size'));
      }
    });
    
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  try {
    const input = await readStdin();
    const output = handleJsonRequest(input);
    process.stdout.write(output + '\n');
    process.exit(0);
  } catch (error) {
    // SECURITY: Output valid JSON even on catastrophic failure
    const errorResponse = {
      ok: false,
      apiVersion: '1.0',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process request'
      },
      meta: { requestHash: 'unavailable' }
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
    process.exit(1);
  }
}

main();