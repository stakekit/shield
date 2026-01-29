#!/bin/bash

# Shield Demo Script
# Run from repository root: ./scripts/demo-validation.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SHIELD: Transaction Validation Demo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
sleep 2

echo "Shield validates transactions from Yield.xyz before signing."
echo "It detects tampering, wrong addresses, and invalid operations."
echo ""
sleep 3

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Get Supported Yield IDs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo '$ echo {"operation":"getSupportedYieldIds"} | ./shield-darwin-x64'
echo ""
sleep 1

echo '{"apiVersion":"1.0","operation":"getSupportedYieldIds"}' | ./shield-darwin-x64 | python3 -m json.tool

echo ""
sleep 3

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  2. Check if a Yield is Supported"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo '$ echo {"operation":"isSupported","yieldId":"ethereum-eth-lido-staking"} | ./shield-darwin-x64'
echo ""
sleep 1

echo '{"apiVersion":"1.0","operation":"isSupported","yieldId":"ethereum-eth-lido-staking"}' | ./shield-darwin-x64 | python3 -m json.tool

echo ""
sleep 3

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  3. Validate a Transaction (Invalid Example)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Attempting to validate a transaction with wrong contract address..."
echo ""
sleep 2

# Transaction points to 0x000...000 instead of Lido contract (0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84)
# Shield should reject this as invalid
echo '$ echo {"operation":"validate","yieldId":"ethereum-eth-lido-staking","unsignedTransaction":"{...wrong address...}"} | ./shield-darwin-x64'
echo ""
sleep 1

echo '{"apiVersion":"1.0","operation":"validate","yieldId":"ethereum-eth-lido-staking","unsignedTransaction":"{\"to\":\"0x0000000000000000000000000000000000000000\",\"data\":\"0x\",\"value\":\"0x1\"}","userAddress":"0x742d35cc6634c0532925a3b844bc9e7595f0beb8"}' | ./shield-darwin-x64 | python3 -m json.tool

echo ""
echo "Shield rejected the transaction - wrong contract address."
echo ""
sleep 3

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  4. Validate a Transaction (Unsupported Yield)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Attempting to validate with an unsupported yield ID..."
echo ""
sleep 2

# "fake-yield-id" is not in the supported list
# Shield should reject with UNSUPPORTED_YIELD error
echo '$ echo {"operation":"validate","yieldId":"fake-yield-id","unsignedTransaction":"{}","userAddress":"0x123"} | ./shield-darwin-x64'
echo ""
sleep 1

echo '{"apiVersion":"1.0","operation":"validate","yieldId":"fake-yield-id","unsignedTransaction":"{}","userAddress":"0x123"}' | ./shield-darwin-x64 | python3 -m json.tool

echo ""
echo "Shield rejected - unsupported yield ID."
echo ""
sleep 3

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  5. Python Integration Example"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Shield works from any language via JSON stdin/stdout."
echo "No Node.js required - just spawn the binary as a subprocess."
echo ""
echo "The Python example:"
echo "  1. Spawns the Shield binary"
echo "  2. Sends JSON request via stdin"
echo "  3. Reads JSON response from stdout"
echo "  4. Parses and displays the result"
echo ""
sleep 3

echo "$ python3 examples/python/shield_example.py"
echo ""
sleep 1

cp ./shield-darwin-x64 examples/python/shield
cd examples/python
python3 shield_example.py
cd ../..

echo ""
sleep 3

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Shield validates transactions via JSON stdin/stdout."
echo "  Works from any language: Python, Go, Rust, etc."
echo ""
echo "  Supported yields:"
echo "    - ethereum-eth-lido-staking"
echo "    - solana-sol-native-multivalidator-staking"
echo "    - tron-trx-native-staking"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup
rm -f examples/python/shield