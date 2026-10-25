# Multi-stage build for production optimization
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS builder

# Set working directory
WORKDIR /app

# Link the native binding to maintained Alpine SQLite, rather than a bundled copy.
ENV npm_config_build_from_source=true npm_config_sqlite=/usr npm_config_nodedir=/usr/local
RUN apk upgrade --no-cache \
    && apk add --no-cache build-base python3 sqlite-dev
COPY package*.json ./
RUN --mount=type=cache,id=webhook-npm,target=/root/.npm npm ci --omit=dev

# Production stage
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS production

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init su-exec sqlite-libs && \
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

# Copy application files
COPY . .

# Copy and set permissions for entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for SQLite database with proper permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R nodeuser:nodejs /app/data /app/logs && \
    chmod 700 /app/data /app/logs

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
    CMD su-exec nodeuser node -e "const r=require('node:http').get('http://127.0.0.1:3000/health',s=>{s.resume();process.exit(s.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.setTimeout(5000,()=>{r.destroy();process.exit(1)})"

# Use entrypoint script to handle permissions and user switching
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the application (will be run as nodeuser by entrypoint)
CMD ["dumb-init", "--", "node", "start.js"]
