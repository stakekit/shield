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
# List supported yields
echo '{"apiVersion":"1.0","operation":"getSupportedYieldIds"}' | npx @yieldxyz/shield

# Check if a yield is supported
echo '{"apiVersion":"1.0","operation":"isSupported","yieldId":"ethereum-eth-lido-staking"}' | npx @yieldxyz/shield

# Validate a transaction
echo '{"apiVersion":"1.0","operation":"validate","yieldId":"ethereum-eth-lido-staking","unsignedTransaction":"{...}","userAddress":"0x..."}' | npx @yieldxyz/shield
```

### Python Example

```python
import subprocess
import json

def validate_transaction(yield_id: str, unsigned_tx: str, user_address: str) -> dict:
    request = {
        "apiVersion": "1.0",
        "operation": "validate",
        "yieldId": yield_id,
        "unsignedTransaction": unsigned_tx,
        "userAddress": user_address
    }

    result = subprocess.run(
        ["npx", "@yieldxyz/shield"],
        input=json.dumps(request),
        capture_output=True,
        text=True
    )

    return json.loads(result.stdout)

# Usage
response = validate_transaction(
    "ethereum-eth-lido-staking",
    '{"to":"0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",...}',
    "0x742d35cc6634c0532925a3b844bc9e7595f0beb8"
)

if response["ok"] and response["result"]["isValid"]:
    print("Transaction is valid!")
else:
    print(f"Blocked: {response['result'].get('reason')}")
```

### Go Example

```go
package main

import (
    "bytes"
    "encoding/json"
    "os/exec"
)

func validateTransaction(yieldId, unsignedTx, userAddress string) (bool, error) {
    request := map[string]string{
        "apiVersion":          "1.0",
        "operation":           "validate",
        "yieldId":             yieldId,
        "unsignedTransaction": unsignedTx,
        "userAddress":         userAddress,
    }

    input, _ := json.Marshal(request)

    cmd := exec.Command("npx", "@yieldxyz/shield")
    cmd.Stdin = bytes.NewReader(input)

    output, err := cmd.Output()
    if err != nil {
        return false, err
    }

    var resp struct {
        Ok     bool `json:"ok"`
        Result struct {
            IsValid bool `json:"isValid"`
        } `json:"result"`
    }
    json.Unmarshal(output, &resp)

    return resp.Ok && resp.Result.IsValid, nil
}
```

### Ruby Example

```ruby
require 'json'
require 'open3'

def validate_transaction(yield_id, unsigned_tx, user_address)
  request = {
    apiVersion: "1.0",
    operation: "validate",
    yieldId: yield_id,
    unsignedTransaction: unsigned_tx,
    userAddress: user_address
  }

  stdout, _status = Open3.capture2("npx @yieldxyz/shield", stdin_data: request.to_json)
  JSON.parse(stdout)
end
```

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
