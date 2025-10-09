import { defineConfig } from '@rslib/core';
import path from 'node:path';

export default defineConfig({
  lib: [
    {
      format: 'cjs',
      syntax: ['es2022'],
      dts: {
        bundle: false,
      },
      source: {
        entry: {
          index: path.join(__dirname, 'src', 'index.ts'),
        },
      },
    },
  ],
  source: {
    tsconfigPath: path.join(__dirname, 'tsconfig.build.json'),
  },
  output: {
    cleanDistPath: true,
    target: 'node',
    distPath: {
      root: './dist',
    },
  },
});
