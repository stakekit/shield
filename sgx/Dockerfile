# Shield SGX Dockerfile
#
# This Dockerfile builds a container image that can run the Shield validator
# inside an Intel SGX enclave using Gramine.

FROM gramineproject/gramine:v1.6.2

# Install Node.js and build dependencies
RUN apt-get update && \
    apt-get install -y \
    curl \
    gnupg \
    make \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.12.2 && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the TypeScript project
RUN pnpm run build

# Build the SGX enclave
WORKDIR /app/sgx
RUN make build

# Expose the service port
EXPOSE 8080

# Set environment variable to indicate SGX environment
ENV IN_SGX=true
ENV NODE_ENV=production

# Default command: run in SGX mode
CMD ["make", "run"]
