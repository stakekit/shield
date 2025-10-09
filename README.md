# 🛡️ @yieldxyz/shield

<div align="center">

[![CI](https://github.com/stakekit/shield/actions/workflows/ci.yml/badge.svg)](https://github.com/stakekit/shield/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@yieldxyz/shield.svg)](https://www.npmjs.com/package/@yieldxyz/shield)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

> Zero-trust transaction validation for Yield.xyz integrations. Shield ensures every transaction is structurally correct and untampered before signing.

## Installation

```bash
npm install @yieldxyz/shield
```

## Usage

```typescript
import { Shield } from '@yieldxyz/shield';

const shield = new Shield();

// Get transaction from Yield API
const response = await fetch('https://api.yield.xyz/v1/actions/enter', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': process.env.YIELD_API_KEY // Your API key
  },
  body: JSON.stringify({
    yieldId: 'ethereum-eth-lido-staking',
    address: userWalletAddress,
    arguments: { amount: '0.01' }
  })
});

const action = await response.json();

// Validate before signing
for (const transaction of action.transactions) {
  const result = shield.validate({
    unsignedTransaction: transaction.unsignedTransaction,
    yieldId: action.yieldId,
    userAddress: userWalletAddress,
    args: action.arguments  // Optional
  });
  
  if (!result.isValid) {
    throw new Error(`Invalid transaction: ${result.reason}`);
  }
}
```

## How It Works

Shield automatically detects and validates transaction types through pattern matching. Each transaction must match exactly one known pattern to be considered valid.

## Supported Yield IDs

- `ethereum-eth-lido-staking`
- `solana-sol-native-multivalidator-staking`
- `tron-trx-native-staking`

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

## License

MIT