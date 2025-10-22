#!/bin/bash
# Validation script for SGX configuration
# This script checks that all SGX files are present and configured correctly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating Shield SGX Configuration..."
echo ""

# Check if we're in the right directory
if [ ! -f "entrypoint.js" ]; then
    echo -e "${RED}✗ Error: Must run from sgx/ directory${NC}"
    exit 1
fi

# Check required files
echo "📁 Checking required files..."
FILES=(
    "entrypoint.js"
    "shield.manifest.template"
    "config.mk"
    "Makefile"
    "Dockerfile"
    "docker-compose.yml"
    "README.md"
    ".dockerignore"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
        exit 1
    fi
done

echo ""
echo "🔧 Checking build prerequisites..."

# Check if parent directory has built files
if [ -f "../dist/index.js" ]; then
    echo -e "  ${GREEN}✓${NC} TypeScript build found"
else
    echo -e "  ${YELLOW}⚠${NC} TypeScript not built - run 'npm run build' first"
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "  ${GREEN}✓${NC} Node.js $NODE_VERSION"
else
    echo -e "  ${RED}✗${NC} Node.js not found"
    exit 1
fi

# Check Make
if command -v make &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Make installed"
else
    echo -e "  ${YELLOW}⚠${NC} Make not found (required for building)"
fi

# Check Gramine (optional, only needed for actual SGX builds)
if command -v gramine-manifest &> /dev/null; then
    GRAMINE_VERSION=$(gramine-manifest --version 2>&1 | head -1)
    echo -e "  ${GREEN}✓${NC} Gramine installed: $GRAMINE_VERSION"
else
    echo -e "  ${YELLOW}⚠${NC} Gramine not found (required for SGX builds)"
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "  ${GREEN}✓${NC} Docker installed: $DOCKER_VERSION"
else
    echo -e "  ${YELLOW}⚠${NC} Docker not found (optional, for containerized builds)"
fi

echo ""
echo "🔍 Validating configuration files..."

# Check manifest template
if grep -q "loader.entrypoint" shield.manifest.template && \
   grep -q "sgx.enclave_size" shield.manifest.template && \
   grep -q "sgx.trusted_files" shield.manifest.template; then
    echo -e "  ${GREEN}✓${NC} Manifest template syntax valid"
else
    echo -e "  ${RED}✗${NC} Manifest template appears invalid"
    exit 1
fi

# Check entrypoint syntax
if node -c entrypoint.js 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Entrypoint.js syntax valid"
else
    echo -e "  ${RED}✗${NC} Entrypoint.js has syntax errors"
    exit 1
fi

# Check Dockerfile syntax
if grep -q "FROM gramineproject/gramine" Dockerfile && \
   grep -q "WORKDIR /app" Dockerfile; then
    echo -e "  ${GREEN}✓${NC} Dockerfile structure valid"
else
    echo -e "  ${RED}✗${NC} Dockerfile appears invalid"
    exit 1
fi

echo ""
echo "🎯 Testing entrypoint functionality..."

# Quick test that entrypoint can load the Shield module
if [ -f "../dist/index.js" ]; then
    PARENT_DIR="$(cd .. && pwd)"
    cat > /tmp/test-shield-load.js <<EOF
try {
    const { Shield } = require('${PARENT_DIR}/dist/index.js');
    const shield = new Shield();
    const yields = shield.getSupportedYieldIds();
    if (yields.length > 0) {
        console.log('✓ Shield loads successfully');
        console.log('  Supported yields:', yields.join(', '));
        process.exit(0);
    } else {
        console.error('✗ No yields registered');
        process.exit(1);
    }
} catch (error) {
    console.error('✗ Failed to load Shield:', error.message);
    process.exit(1);
}
EOF

    node /tmp/test-shield-load.js
    rm -f /tmp/test-shield-load.js
else
    echo -e "  ${YELLOW}⚠${NC} Skipping load test (build not found)"
fi

echo ""
echo -e "${GREEN}✅ All validations passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Build: make build (requires Gramine)"
echo "  2. Run:   make run (requires SGX hardware)"
echo "  3. Or use Docker: docker-compose up"
echo ""
echo "See README.md for detailed instructions."
