import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const BUNDLE = join(ROOT, 'dist', 'cli.bundled.js');

describe('CLI stdout flush (large response not truncated over a pipe)', () => {
  beforeAll(() => {
    // CI builds after tests; ensure the SEA entry bundle exists.
    if (!existsSync(BUNDLE)) {
      execSync('pnpm build:cli:bundle', { cwd: ROOT, stdio: 'inherit' });
    }
  }, 120_000);

  it('returns the full getSupportedYieldIds payload (>64KB) over a pipe', () => {
    const req = JSON.stringify({
      apiVersion: '1.0',
      operation: 'getSupportedYieldIds',
    });

    // spawnSync captures stdout via a pipe — the exact path that truncated at 64KB.
    const res = spawnSync(process.execPath, [BUNDLE], {
      input: req,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    expect(res.status).toBe(0);
    // Regression: output was truncated to exactly 65536 bytes.
    expect(res.stdout.length).toBeGreaterThan(64 * 1024);
    const parsed = JSON.parse(res.stdout); // would throw on truncated JSON
    expect(parsed.ok).toBe(true);
    expect(parsed.result.yieldIds.length).toBeGreaterThan(1000);
  });
});
