# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./
COPY babel.config.cjs ./

# Install all dependencies
RUN npm install

# Copy source code
COPY src ./src

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./
COPY babel.config.cjs ./

# Install all dependencies (we need ts-node and ts-patch at runtime for ESM execution)
RUN npm install && \
    npm cache clean --force

# Copy built application from builder
COPY src ./src

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose WebSocket port (adjust if your server uses a different port)
EXPOSE 8080

# Health check - verify WebSocket port is listening
HEALTHCHECK CMD node -e "require('net').createConnection({port: 8080, timeout: 2000}, () => process.exit(0)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "--loader", "ts-node/esm", "src/index.ts"]
