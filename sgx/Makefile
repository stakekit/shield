# Makefile for Shield SGX Enclave

include config.mk

.PHONY: all build run clean distclean

all: build

# Build the manifest and sign it
build: shield.manifest.sgx shield.sig
	@echo "SGX enclave built successfully"
	@echo "Run with: make run"

# Run the application in SGX
run: build
	@echo "Starting Shield validator in SGX enclave..."
	gramine-sgx shield $(APP_DIR)/sgx/entrypoint.js

# Run in direct mode (without SGX, for testing)
run-direct: shield.manifest
	@echo "Starting Shield validator in direct mode (no SGX)..."
	gramine-direct shield $(APP_DIR)/sgx/entrypoint.js

# Test the SGX setup
test: build
	@echo "Testing SGX enclave..."
	@timeout 5 gramine-sgx shield $(APP_DIR)/sgx/entrypoint.js & \
	SERVER_PID=$$!; \
	sleep 2; \
	curl -s http://localhost:8080/health | python3 -m json.tool || true; \
	kill $$SERVER_PID 2>/dev/null || true

clean:
	$(RM) *.manifest *.manifest.sgx *.sig *.token

distclean: clean
	$(RM) -r OUTPUT

.PHONY: help
help:
	@echo "Shield SGX Makefile"
	@echo ""
	@echo "Targets:"
	@echo "  all         - Build the SGX enclave (default)"
	@echo "  build       - Build the manifest and sign it"
	@echo "  run         - Run the validator in SGX mode"
	@echo "  run-direct  - Run in direct mode (no SGX, for testing)"
	@echo "  test        - Quick test of the SGX setup"
	@echo "  clean       - Remove generated files"
	@echo "  distclean   - Remove all generated files and outputs"
	@echo "  help        - Show this help message"
	@echo ""
	@echo "Configuration:"
	@echo "  Edit config.mk to customize paths and settings"
