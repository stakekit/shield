# Go Integration

Shield can be called from Go as a subprocess. No Node.js runtime required when using the standalone binary.

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

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
)

type ShieldRequest struct {
	ApiVersion          string `json:"apiVersion"`
	Operation           string `json:"operation"`
	YieldId             string `json:"yieldId,omitempty"`
	UnsignedTransaction string `json:"unsignedTransaction,omitempty"`
	UserAddress         string `json:"userAddress,omitempty"`
}

type ShieldResponse struct {
	Ok     bool `json:"ok"`
	Result struct {
		IsValid      bool     `json:"isValid"`
		Reason       string   `json:"reason,omitempty"`
		DetectedType string   `json:"detectedType,omitempty"`
		YieldIds     []string `json:"yieldIds,omitempty"`
	} `json:"result"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func CallShield(shieldPath string, request ShieldRequest) (*ShieldResponse, error) {
	inputJSON, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	cmd := exec.Command(shieldPath)
	cmd.Stdin = bytes.NewReader(inputJSON)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("shield process failed: %w", err)
	}

	var response ShieldResponse
	if err := json.Unmarshal(output, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

func main() {
	// Example 1: Get supported yield IDs
	resp, err := CallShield("./shield", ShieldRequest{
		ApiVersion: "1.0",
		Operation:  "getSupportedYieldIds",
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Supported yields: %v\n", resp.Result.YieldIds)

	// Example 2: Validate a transaction
	tx := `{"to":"0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84","from":"0x742d35cc6634c0532925a3b844bc9e7595f0beb8","value":"0xde0b6b3a7640000","data":"0xa1903eab000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb8","chainId":1}`

	resp, err = CallShield("./shield", ShieldRequest{
		ApiVersion:          "1.0",
		Operation:           "validate",
		YieldId:             "ethereum-eth-lido-staking",
		UnsignedTransaction: tx,
		UserAddress:         "0x742d35cc6634c0532925a3b844bc9e7595f0beb8",
	})
	if err != nil {
		panic(err)
	}

	if resp.Ok && resp.Result.IsValid {
		fmt.Printf("✅ Valid transaction (type: %s)\n", resp.Result.DetectedType)
	} else if resp.Ok {
		fmt.Printf("❌ Invalid: %s\n", resp.Result.Reason)
	} else {
		fmt.Printf("⚠️ Error: %s - %s\n", resp.Error.Code, resp.Error.Message)
	}
}
```

## Running the Example

```bash
# Save the above code to main.go, then:
go run main.go
```
