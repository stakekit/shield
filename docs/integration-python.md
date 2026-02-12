# Python Integration

Shield can be called from Python as a subprocess. No Node.js runtime required when using the standalone binary.

## Installation

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

## Verify Download Integrity

After downloading, verify the SHA256 checksum to ensure the binary hasn't been tampered with:

```bash
# Download checksum file
curl -LO https://github.com/stakekit/shield/releases/latest/download/shield-darwin-arm64.sha256

# Verify (should output: shield-darwin-arm64: OK)
shasum -a 256 -c shield-darwin-arm64.sha256
```

## Example Usage

```python
import subprocess
import json
from dataclasses import dataclass
from typing import Optional, Union, List

@dataclass
class ShieldResult:
    is_valid: bool
    reason: Optional[str] = None
    detected_type: Optional[str] = None
    yield_ids: Optional[List[str]] = None

@dataclass
class ShieldError:
    code: str
    message: str

def call_shield(
    shield_path: str,
    operation: str,
    yield_id: Optional[str] = None,
    unsigned_tx: Optional[str] = None,
    user_address: Optional[str] = None
) -> tuple[bool, Union[ShieldResult, ShieldError]]:
    """
    Call Shield binary with a request.

    Args:
        shield_path: Path to the Shield binary
        operation: "validate" or "getSupportedYieldIds"
        yield_id: The yield integration ID (required for validate)
        unsigned_tx: JSON string of the unsigned transaction (required for validate)
        user_address: The user's wallet address (required for validate)

    Returns:
        (ok, result) - If ok is True, result is ShieldResult. Otherwise, ShieldError.
    """
    request = {
        "apiVersion": "1.0",
        "operation": operation,
    }
    if yield_id:
        request["yieldId"] = yield_id
    if unsigned_tx:
        request["unsignedTransaction"] = unsigned_tx
    if user_address:
        request["userAddress"] = user_address

    result = subprocess.run(
        [shield_path],
        input=json.dumps(request),
        capture_output=True,
        text=True,
    )

    response = json.loads(result.stdout)

    if response["ok"]:
        return True, ShieldResult(
            is_valid=response["result"].get("isValid", False),
            reason=response["result"].get("reason"),
            detected_type=response["result"].get("detectedType"),
            yield_ids=response["result"].get("yieldIds"),
        )
    else:
        return False, ShieldError(
            code=response["error"]["code"],
            message=response["error"]["message"],
        )


if __name__ == "__main__":
    # Example 1: Get supported yield IDs
    ok, result = call_shield("./shield", "getSupportedYieldIds")
    if ok:
        print(f"Supported yields: {result.yield_ids}")

    # Example 2: Validate a transaction
    tx = json.dumps({
        "to": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
        "from": "0x742d35cc6634c0532925a3b844bc9e7595f0beb8",
        "value": "0xde0b6b3a7640000",
        "data": "0xa1903eab000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb8",
        "chainId": 1,
    })

    ok, result = call_shield(
        "./shield",
        "validate",
        yield_id="ethereum-eth-lido-staking",
        unsigned_tx=tx,
        user_address="0x742d35cc6634c0532925a3b844bc9e7595f0beb8"
    )

    if ok and result.is_valid:
        print(f"✅ Valid transaction (type: {result.detected_type})")
    elif ok:
        print(f"❌ Invalid: {result.reason}")
    else:
        print(f"⚠️ Error: {result.code} - {result.message}")
```

## Running the Example

```bash
# Save the above code to shield_example.py, then:
python shield_example.py
```
