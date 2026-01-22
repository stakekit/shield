// Shield Rust Integration Example
//
// Usage:
//   1. Download the Shield binary for your platform
//   2. Place it in this directory as ./shield
//   3. Run: cargo run

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ShieldRequest {
    api_version: String,
    operation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    yield_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    unsigned_transaction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_address: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ShieldResponse {
    ok: bool,
    result: Option<ShieldResult>,
    error: Option<ShieldError>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ShieldResult {
    is_valid: Option<bool>,
    reason: Option<String>,
    detected_type: Option<String>,
    yield_ids: Option<Vec<String>>,
}

#[derive(Deserialize, Debug)]
struct ShieldError {
    code: String,
    message: String,
}

fn call_shield(shield_path: &str, request: ShieldRequest) -> Result<ShieldResponse, Box<dyn std::error::Error>> {
    let input = serde_json::to_string(&request)?;

    let mut child = Command::new(shield_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;

    child.stdin.as_mut().unwrap().write_all(input.as_bytes())?;

    let output = child.wait_with_output()?;
    let response: ShieldResponse = serde_json::from_slice(&output.stdout)?;

    Ok(response)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Example 1: Get supported yield IDs
    let response = call_shield("./shield", ShieldRequest {
        api_version: "1.0".to_string(),
        operation: "getSupportedYieldIds".to_string(),
        yield_id: None,
        unsigned_transaction: None,
        user_address: None,
    })?;

    if let Some(result) = &response.result {
        println!("Supported yields: {:?}", result.yield_ids);
    }

    // Example 2: Validate a transaction
    let tx = r#"{"to":"0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84","from":"0x742d35cc6634c0532925a3b844bc9e7595f0beb8","value":"0xde0b6b3a7640000","data":"0xa1903eab000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb8","chainId":1}"#;

    let response = call_shield("./shield", ShieldRequest {
        api_version: "1.0".to_string(),
        operation: "validate".to_string(),
        yield_id: Some("ethereum-eth-lido-staking".to_string()),
        unsigned_transaction: Some(tx.to_string()),
        user_address: Some("0x742d35cc6634c0532925a3b844bc9e7595f0beb8".to_string()),
    })?;

    if response.ok {
        if let Some(result) = response.result {
            if result.is_valid.unwrap_or(false) {
                println!("✅ Valid transaction (type: {:?})", result.detected_type);
            } else {
                println!("❌ Invalid: {:?}", result.reason);
            }
        }
    } else if let Some(error) = response.error {
        println!("⚠️ Error: {} - {}", error.code, error.message);
    }

    Ok(())
}

