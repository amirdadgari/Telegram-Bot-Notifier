#!/bin/sh

# Docker entrypoint script to handle permissions and initialization

set -e
umask 077

echo "🐳 Docker entrypoint: Setting up permissions..."

# Ensure data directory exists and has correct permissions
if [ ! -d "/app/data" ]; then
    echo "📁 Creating /app/data directory..."
    mkdir -p /app/data
fi

# Fix ownership and permissions for data directory
echo "🔧 Setting ownership for /app/data..."
chown -R nodeuser:nodejs /app/data
find /app/data -type d -exec chmod 700 {} +
find /app/data -type f -exec chmod 600 {} +

# Ensure nodeuser can write to the data directory
echo "✅ Testing write permissions..."
if su-exec nodeuser touch /app/data/.write-test 2>/dev/null; then
    rm -f /app/data/.write-test
    echo "✅ Write permissions OK"
else
    echo "❌ Data directory is not writable by the application user"
    exit 1
fi

# Create logs directory if it doesn't exist
if [ ! -d "/app/logs" ]; then
    mkdir -p /app/logs
    chown nodeuser:nodejs /app/logs
    chmod 700 /app/logs
fi
chown -R nodeuser:nodejs /app/logs
find /app/logs -type d -exec chmod 700 {} +
find /app/logs -type f -exec chmod 600 {} +

echo "🚀 Starting application as nodeuser..."

# Switch to nodeuser and execute the command
exec su-exec nodeuser "$@"
