# Shield SGX - Intel SGX Enclave Support

This directory contains the configuration and scripts needed to run the Shield transaction validator inside an Intel SGX enclave using [Gramine](https://gramine.readthedocs.io/).

## Overview

Running Shield in SGX provides:

- **Hardware-level isolation**: Validation logic runs in a trusted execution environment
- **Code integrity**: The enclave code is measured and cannot be tampered with
- **Confidentiality**: Memory is encrypted and protected from the host OS
- **Remote attestation**: Prove to remote parties that validation is running in genuine SGX
- **Zero-trust validation**: Even the host system cannot manipulate transaction validation

## Architecture

```
┌─────────────────────────────────────────┐
│         Untrusted Environment           │
│  ┌─────────────────────────────────┐   │
│  │    HTTP API Client/User App     │   │
│  └──────────────┬──────────────────┘   │
│                 │ HTTPS                 │
│                 ▼                       │
│  ┌─────────────────────────────────┐   │
│  │      SGX Enclave (Gramine)      │   │
│  │  ┌───────────────────────────┐  │   │
│  │  │   Node.js Runtime         │  │   │
│  │  │   ┌───────────────────┐   │  │   │
│  │  │   │  Shield Validator │   │  │   │
│  │  │   │  - Lido           │   │  │   │
│  │  │   │  - Solana         │   │  │   │
│  │  │   │  - Tron           │   │  │   │
│  │  │   └───────────────────┘   │  │   │
│  │  └───────────────────────────┘  │   │
│  │         Encrypted Memory         │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Prerequisites

### Hardware Requirements

- CPU with Intel SGX support (SGX1 or SGX2)
- SGX must be enabled in BIOS
- Minimum 1GB of EPC (Enclave Page Cache) memory

Check SGX support:
```bash
cpuid | grep -i sgx
# or
dmesg | grep -i sgx
```

### Software Requirements

**Option 1: Native Installation**
- Ubuntu 20.04+ or similar Linux distribution
- Gramine v1.6+ ([installation guide](https://gramine.readthedocs.io/en/stable/installation.html))
- Intel SGX Driver/DCAP driver
- Node.js 20+
- Make

**Option 2: Docker (Recommended)**
- Docker with SGX support
- Intel SGX driver installed on host

## Quick Start

### Using Docker (Recommended)

1. **Build the container:**
   ```bash
   cd sgx
   docker-compose build
   ```

2. **Run in SGX mode:**
   ```bash
   docker-compose up shield-sgx
   ```

3. **Test the service:**
   ```bash
   curl http://localhost:8080/health
   ```

### Using Native Installation

1. **Build the TypeScript project:**
   ```bash
   npm run build
   ```

2. **Build the SGX enclave:**
   ```bash
   cd sgx
   make build
   ```

3. **Run in SGX mode:**
   ```bash
   make run
   ```

4. **Or run in direct mode (no SGX, for testing):**
   ```bash
   make run-direct
   ```

### Using npm Scripts

```bash
# Build everything including SGX enclave
npm run sgx:build

# Run in SGX mode
npm run sgx:run

# Run in direct mode (no SGX)
npm run sgx:run-direct

# Run quick test
npm run sgx:test

# Clean SGX build artifacts
npm run sgx:clean
```

## API Usage

The SGX enclave exposes an HTTP API for transaction validation.

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "environment": "SGX",
  "supportedYields": [
    "ethereum-eth-lido-staking",
    "solana-sol-native-multivalidator-staking",
    "tron-trx-native-staking"
  ]
}
```

### Validate Transaction

```bash
curl -X POST http://localhost:8080/validate \
  -H "Content-Type: application/json" \
  -d '{
    "yieldId": "ethereum-eth-lido-staking",
    "unsignedTransaction": "0x...",
    "userAddress": "0x...",
    "args": {
      "amount": "0.01"
    }
  }'
```

Response:
```json
{
  "isValid": true,
  "detectedType": "stake"
}
```

Or if invalid:
```json
{
  "isValid": false,
  "reason": "Invalid referral address",
  "details": { ... }
}
```

## Configuration

### Manifest Configuration

Edit `config.mk` to customize the SGX enclave settings:

```makefile
# Enclave size (1G, 2G, 4G, etc.)
ENCLAVE_SIZE ?= 1G

# Maximum threads in enclave
MAX_THREADS ?= 4

# Debug mode (0 for production, 1 for debug)
SGX_DEBUG ?= 0

# Remote attestation type (dcap, epid, none)
RA_TYPE ?= dcap

# Node.js binary path
NODEJS ?= /usr/bin/node
```

### Environment Variables

- `PORT`: HTTP server port (default: 8080)
- `NODE_ENV`: Node.js environment (production/development)
- `GRAMINE_LOG_LEVEL`: Gramine log level (error/warning/info/debug)

## Remote Attestation

Remote attestation allows clients to cryptographically verify that the validator is running in a genuine SGX enclave.

### DCAP Attestation (Recommended)

DCAP (Datacenter Attestation Primitives) is the modern attestation method:

```bash
# Generate attestation quote
gramine-sgx-quote shield

# The quote can be verified by remote parties using Intel's PCCS
```

### Configuring Attestation

1. Install Intel DCAP libraries
2. Configure PCCS (Provisioning Certificate Caching Service)
3. Set `RA_TYPE=dcap` in `config.mk`

See [Intel SGX DCAP documentation](https://download.01.org/intel-sgx/latest/dcap-latest/linux/docs/) for details.

## Production Deployment

### Security Checklist

- [ ] Set `SGX_DEBUG=0` in `config.mk` (production mode)
- [ ] Use HTTPS/TLS for all API communication
- [ ] Implement authentication/authorization for API endpoints
- [ ] Enable remote attestation and verify quotes
- [ ] Regularly update Gramine and SGX drivers
- [ ] Monitor enclave metrics and attestation status
- [ ] Use dedicated SGX-capable hardware
- [ ] Implement rate limiting and DDoS protection
- [ ] Set up proper logging and monitoring

### Performance Tuning

1. **Enclave Size**: Adjust `ENCLAVE_SIZE` based on workload
2. **Thread Count**: Set `MAX_THREADS` to match expected concurrency
3. **Memory**: Ensure sufficient EPC memory for the enclave
4. **Network**: Use efficient serialization for API requests/responses

### Monitoring

Monitor these SGX-specific metrics:

- Enclave creation/destruction events
- EPC page faults
- Enclave exits (frequency and reasons)
- Attestation success/failure rates
- Memory usage within enclave

## Troubleshooting

### "SGX device not found"

```bash
# Check if SGX driver is loaded
ls -l /dev/sgx*

# Load the driver
sudo modprobe intel_sgx
```

### "Enclave creation failed"

- Check if SGX is enabled in BIOS
- Verify EPC memory is available
- Ensure `ENCLAVE_SIZE` in config.mk is not too large
- Try setting `SGX_DEBUG=1` for more verbose output

### "Out of EPC memory"

- Reduce `ENCLAVE_SIZE` in `config.mk`
- Reduce `MAX_THREADS`
- Close other SGX applications
- Consider using a system with more EPC memory

### "Attestation failed"

- Verify AESMD service is running: `systemctl status aesmd`
- Check PCCS configuration
- Ensure network connectivity to Intel Attestation Service
- Verify SGX platform is up to date

### Performance Issues

- Profile with `SGX_DEBUG=1` to identify bottlenecks
- Reduce enclave exits (minimize I/O, syscalls)
- Optimize thread count
- Consider using larger enclave size if memory is constrained

## Development

### Testing Without SGX

Use direct mode to test without SGX hardware:

```bash
make run-direct
```

This runs the same code but without SGX protection, useful for:
- Development on non-SGX hardware
- Debugging
- CI/CD pipelines

### Debug Mode

Enable debug mode for development:

```bash
# In config.mk
SGX_DEBUG=1

# Rebuild
make clean && make build
```

Debug mode provides:
- Detailed logging
- Debug symbols
- Ability to attach debuggers

**⚠️ Never use debug mode in production!**

## Files

- `entrypoint.js` - HTTP server entry point for the enclave
- `shield.manifest.template` - Gramine manifest template
- `config.mk` - Build configuration
- `Makefile` - Build automation
- `Dockerfile` - Container image definition
- `docker-compose.yml` - Docker orchestration

## Resources

- [Gramine Documentation](https://gramine.readthedocs.io/)
- [Intel SGX Developer Reference](https://www.intel.com/content/www/us/en/developer/tools/software-guard-extensions/overview.html)
- [SGX DCAP Attestation](https://download.01.org/intel-sgx/latest/dcap-latest/linux/docs/)
- [Shield Library Documentation](../README.md)

## Security Considerations

### Trusted Computing Base (TCB)

The SGX TCB includes:
- Intel SGX hardware and microcode
- Gramine library OS
- Node.js runtime
- Shield validator code
- Dependencies (ethers, solana/web3.js, tronweb)

### Attack Surface

Even with SGX, consider:
- **Side-channel attacks**: SGX does not protect against all side channels
- **Denial of Service**: Host can still kill the enclave
- **Rollback attacks**: Ensure state freshness if maintaining state
- **Input validation**: Always validate inputs before processing

### Best Practices

1. Minimize secrets in the enclave
2. Use sealed storage for persistent secrets
3. Implement rate limiting at the API layer
4. Verify attestation quotes before trusting results
5. Keep TCB components updated
6. Monitor for anomalous behavior

## License

MIT - See [LICENSE](../LICENSE) file
