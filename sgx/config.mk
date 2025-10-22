# Gramine Configuration for Shield SGX

# Architecture library directory
ARCH_LIBDIR ?= /lib/x86_64-linux-gnu

# Node.js binary path (adjust based on your system)
NODEJS ?= /usr/bin/node

# Application directory (where the built code lives)
APP_DIR ?= $(CURDIR)/..

# Gramine settings
GRAMINE_LOG_LEVEL ?= error

# SGX settings
SGX_DEBUG ?= 0
ENCLAVE_SIZE ?= 1G
MAX_THREADS ?= 4

# Remote attestation type (dcap, epid, or none)
RA_TYPE ?= dcap

.PHONY: all
all: shield.manifest shield.manifest.sgx shield.sig

%.manifest: %.manifest.template config.mk
	gramine-manifest \
		-Dlog_level=$(GRAMINE_LOG_LEVEL) \
		-Dentrypoint=$(NODEJS) \
		-Darch_libdir=$(ARCH_LIBDIR) \
		-Dapp_dir=$(APP_DIR) \
		-Ddebug=$(SGX_DEBUG) \
		-Denclave_size=$(ENCLAVE_SIZE) \
		-Dmax_threads=$(MAX_THREADS) \
		-Dra_type=$(RA_TYPE) \
		$< > $@

%.manifest.sgx %.sig: %.manifest
	gramine-sgx-sign \
		--manifest $< \
		--output $@

.PHONY: clean
clean:
	$(RM) *.manifest *.manifest.sgx *.sig *.token

.PHONY: distclean
distclean: clean
