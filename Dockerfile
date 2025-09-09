# Multi-stage build for smaller image size
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src/mcp-standalone.ts ./src/

# Build the application
RUN pnpm run build

# Production stage
FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Make the standalone script executable
RUN chmod +x dist/mcp-standalone.js

# Create directory for token storage and set ownership
RUN mkdir -p /home/node/.whoop-mcp && \
    chown -R node:node /home/node/.whoop-mcp

# Change ownership of app directory
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Set environment variables (can be overridden at runtime)
ENV NODE_ENV=production

# The MCP server uses stdio, so we don't expose any ports
# Run the standalone MCP server
CMD ["node", "dist/mcp-standalone.js"]