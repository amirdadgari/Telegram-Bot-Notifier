#!/bin/sh

# Docker entrypoint script to handle permissions and initialization

set -e

echo "🐳 Docker entrypoint: Setting up permissions..."

# Ensure data directory exists and has correct permissions
if [ ! -d "/app/data" ]; then
    echo "📁 Creating /app/data directory..."
    mkdir -p /app/data
fi

# Fix ownership and permissions for data directory
echo "🔧 Setting ownership for /app/data..."
chown -R nodeuser:nodejs /app/data
chmod -R 755 /app/data

# Ensure nodeuser can write to the data directory
echo "✅ Testing write permissions..."
if su-exec nodeuser touch /app/data/.write-test 2>/dev/null; then
    rm -f /app/data/.write-test
    echo "✅ Write permissions OK"
else
    echo "❌ Write permission test failed, fixing..."
    # Force fix permissions
    chmod 777 /app/data
    chown -R nodeuser:nodejs /app/data
fi

# Create logs directory if it doesn't exist
if [ ! -d "/app/logs" ]; then
    mkdir -p /app/logs
    chown nodeuser:nodejs /app/logs
    chmod 755 /app/logs
fi

echo "🚀 Starting application as nodeuser..."

# Switch to nodeuser and execute the command
exec su-exec nodeuser "$@"
