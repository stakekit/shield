# Shield Integration Examples

This directory contains runnable examples for integrating Shield with different programming languages.

## Prerequisites

Download the Shield binary for your platform from [GitHub Releases](https://github.com/stakekit/shield/releases):

```bash
# Linux (x64)
curl -L https://github.com/stakekit/shield/releases/latest/download/shield-linux-x64 -o shield
chmod +x shield

# macOS (Apple Silicon)
curl -L https://github.com/stakekit/shield/releases/latest/download/shield-darwin-arm64 -o shield
chmod +x shield

# macOS (Intel)
curl -L https://github.com/stakekit/shield/releases/latest/download/shield-darwin-x64 -o shield
chmod +x shield

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/stakekit/shield/releases/latest/download/shield-windows-x64.exe -OutFile shield.exe
```

## Verify Download Integrity (Recommended)

Always verify the SHA256 checksum before using the binary:

```bash
# Download checksum (use the same platform as your binary)
curl -LO https://github.com/stakekit/shield/releases/latest/download/shield-darwin-arm64.sha256

# Verify
shasum -a 256 -c shield-darwin-arm64.sha256
# Expected output: shield-darwin-arm64: OK
```

## Python

```bash
cd python
cp /path/to/shield ./shield   # Copy binary here
python shield_example.py
```

## Go

```bash
cd go
cp /path/to/shield ./shield   # Copy binary here
go run main.go
```

## Rust

```bash
cd rust
cp /path/to/shield ./shield   # Copy binary here
cargo run
```

## What the Examples Do

Each example demonstrates:

1. **`getSupportedYieldIds`** - Lists all supported yield integration IDs
2. **`validate`** - Validates a sample Ethereum Lido staking transaction

## Expected Output

```
Supported yields: ["solana-sol-native-multivalidator-staking", "ethereum-eth-lido-staking", "tron-trx-native-staking"]
❌ Invalid: Transaction validation failed: ...
```

The validation fails because the example uses a sample transaction that doesn't match the expected pattern. In real usage, you would pass actual unsigned transactions from your staking flow.
