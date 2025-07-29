# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init su-exec && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user first
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# copy public directory
COPY public ./public

# Copy application files
COPY --chown=nodeuser:nodejs . .

# Copy and set permissions for entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for SQLite database with proper permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R nodeuser:nodejs /app/data /app/logs && \
    chmod 755 /app/data /app/logs

# Remove unnecessary files
RUN rm -rf .git .github netlify .env.example README.md CONTRIBUTING.md docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/database.db

# Expose port
EXPOSE 3000

# Add healthcheck (run as nodeuser)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD su-exec nodeuser node -e "require('http').get('http://localhost:3000/', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use entrypoint script to handle permissions and user switching
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the application (will be run as nodeuser by entrypoint)
CMD ["dumb-init", "--", "node", "start.js"]
