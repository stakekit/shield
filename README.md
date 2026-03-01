# 🛡️ @yieldxyz/shield

<div align="center">

[![CI](https://github.com/stakekit/shield/actions/workflows/ci.yml/badge.svg)](https://github.com/stakekit/shield/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@yieldxyz/shield.svg)](https://www.npmjs.com/package/@yieldxyz/shield)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

> Zero-trust transaction validation for Yield.xyz integrations. Shield ensures every transaction is structurally correct and untampered before signing.

## Installation

### For TypeScript/JavaScript Projects

```bash
npm install @yieldxyz/shield
```

### For Other Languages (Standalone Binary)

Download the pre-built binary for your platform from [GitHub Releases](https://github.com/stakekit/shield/releases):

| Platform              | Download                 |
| --------------------- | ------------------------ |
| Linux (x64)           | `shield-linux-x64`       |
| macOS (Apple Silicon) | `shield-darwin-arm64`    |
| macOS (Intel)         | `shield-darwin-x64`      |
| Windows               | `shield-windows-x64.exe` |

```bash
# Example: Download for macOS Apple Silicon
curl -L https://github.com/stakekit/shield/releases/latest/download/shield-darwin-arm64 -o shield
chmod +x shield

# Verify integrity (recommended)
curl -LO https://github.com/stakekit/shield/releases/latest/download/shield-darwin-arm64.sha256
shasum -a 256 -c shield-darwin-arm64.sha256
# Expected output: shield-darwin-arm64: OK
```

See the [examples/](./examples/) directory for complete integration examples in Python, Go, and Rust.

## Usage

```typescript
import { Shield } from '@yieldxyz/shield';

const shield = new Shield();

// Get transaction from Yield API
const response = await fetch('https://api.yield.xyz/v1/actions/enter', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.YIELD_API_KEY, // Your API key
  },
  body: JSON.stringify({
    yieldId: 'ethereum-eth-lido-staking',
    address: userWalletAddress,
    arguments: { amount: '0.01' },
  }),
});

const action = await response.json();

// Validate before signing
for (const transaction of action.transactions) {
  const result = shield.validate({
    unsignedTransaction: transaction.unsignedTransaction,
    yieldId: action.yieldId,
    userAddress: userWalletAddress,
    args: action.arguments, // Optional
  });

  if (!result.isValid) {
    throw new Error(`Invalid transaction: ${result.reason}`);
  }
}
```

## How It Works

Shield automatically detects and validates transaction types through pattern matching. Each transaction must match exactly one known pattern to be considered valid.

## Using Shield from Other Languages

Shield is written in TypeScript, but can be used from **any programming language** via its CLI (Command Line Interface).

### Why Two Approaches?

| Your Language                      | How to Use Shield                                 |
| ---------------------------------- | ------------------------------------------------- |
| TypeScript/JavaScript              | Import the library directly (see [Usage](#usage)) |
| Python, Go, Ruby, Rust, Java, etc. | Use the CLI via subprocess                        |

The CLI approach means you get the **exact same validation logic** without rewriting Shield in your language.

### The JSON Protocol

The CLI reads JSON from stdin and writes JSON to stdout:

**Input:**

```json
{
  "apiVersion": "1.0",
  "operation": "validate",
  "yieldId": "ethereum-eth-lido-staking",
  "unsignedTransaction": "{\"to\":\"0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84\",...}",
  "userAddress": "0x742d35cc6634c0532925a3b844bc9e7595f0beb8"
}
```

**Output:**

```json
{
  "ok": true,
  "apiVersion": "1.0",
  "result": {
    "isValid": true,
    "detectedType": "STAKE"
  },
  "meta": {
    "requestHash": "a1b2c3..."
  }
}
```

### Operations

| Operation              | Required Fields                                 | Description                   |
| ---------------------- | ----------------------------------------------- | ----------------------------- |
| `validate`             | `yieldId`, `unsignedTransaction`, `userAddress` | Validate a transaction        |
| `isSupported`          | `yieldId`                                       | Check if a yield is supported |
| `getSupportedYieldIds` | (none)                                          | List all supported yields     |

### CLI Examples (Bash)

```bash
# Check if a yield is supported
echo '{"apiVersion":"1.0","operation":"isSupported","yieldId":"ethereum-eth-lido-staking"}' | npx @yieldxyz/shield

# Validate a transaction
echo '{"apiVersion":"1.0","operation":"validate","yieldId":"ethereum-eth-lido-staking","unsignedTransaction":"{...}","userAddress":"0x..."}' | npx @yieldxyz/shield


# List supported yields
echo '{"apiVersion":"1.0","operation":"getSupportedYieldIds"}' | npx @yieldxyz/shield
```

## Supported Yield IDs

- `ethereum-eth-lido-staking`
- `solana-sol-native-multivalidator-staking`
- `tron-trx-native-staking`
- All generic ERC4626 vault yields from: Angle, Curve, Euler, Fluid, Gearbox, Idle Finance, Lista, Morpho, Sky, SummerFi, Venus Flux, Yearn, Yo Protocol

To see the full list:

```bash
echo '{"apiVersion":"1.0","operation":"getSupportedYieldIds"}' | npx @yieldxyz/shield
```

> **Note:** Aave, Maple, Spark use non-standard transaction flows and are not yet supported. Protocol-specific validators for these will be added in a future release.

### ERC4626 Vault Operations

Shield validates the following operations for all supported ERC4626 vaults:

| Operation   | Transaction Type | Description                                   |
| ----------- | ---------------- | --------------------------------------------- |
| Approve     | APPROVAL         | ERC20 token approval for vault deposit        |
| Deposit     | SUPPLY           | Deposit assets into vault                     |
| Mint        | SUPPLY           | Mint vault shares                             |
| Withdraw    | WITHDRAW         | Withdraw assets from vault                    |
| Redeem      | WITHDRAW         | Redeem vault shares                           |
| WETH Wrap   | WRAP             | Convert native ETH to WETH (WETH vaults only) |
| WETH Unwrap | UNWRAP           | Convert WETH to native ETH (WETH vaults only) |

## API Reference

### `shield.validate(request)`

Validates a transaction by auto-detecting its type.

**Parameters:**

```typescript
{
  unsignedTransaction: string;  // Transaction from Yield API
  yieldId: string;              // Yield integration ID
  userAddress: string;          // User's wallet address
  args?: ActionArguments;       // Optional arguments
  context?: ValidationContext;  // Optional context
}
```

**Returns:**

```typescript
{
  isValid: boolean;
  reason?: string;         // Why validation failed
  details?: any;          // Additional error details
  detectedType?: string;  // Auto-detected type (for debugging)
}
```

### `shield.isSupported(yieldId)`

Check if a yield is supported.

### `shield.getSupportedYieldIds()`

Get all supported yield IDs.

## Error Messages

Common validation failures:

- `"Invalid referral address"` - Wrong referral in transaction
- `"Withdrawal owner does not match user address"` - Ownership mismatch
- `"Transaction validation failed: No matching operation pattern found"` - Transaction doesn't match any supported pattern
- `"Transaction validation failed: Ambiguous transaction pattern detected"` - Transaction matches multiple patterns

## Security

Shield is designed with security as a top priority:

- **Input Validation**: All inputs are validated against strict JSON schemas with size limits (100KB max)
- **Pattern Matching**: Transactions must match exactly one known pattern to be valid
- **No Network Access**: The CLI binary has no network capabilities - it only reads stdin and writes stdout
- **Checksum Verification**: All release binaries include SHA256 checksums for integrity verification

### Embedded Vault Registry

ERC4626 vault data is embedded in the package at build time from `vault-registry.json`. The registry includes allocator vault (OAV) addresses for yields with fee configurations. Transactions targeting allocator vaults are validated using the same ERC4626 standard.

### Verifying Binary Integrity

Always verify downloaded binaries:

```bash
# Download binary and checksum
curl -LO https://github.com/stakekit/shield/releases/latest/download/shield-darwin-arm64
curl -LO https://github.com/stakekit/shield/releases/latest/download/shield-darwin-arm64.sha256

# Verify
shasum -a 256 -c shield-darwin-arm64.sha256
# Expected: shield-darwin-arm64: OK
```

## License

MIT
