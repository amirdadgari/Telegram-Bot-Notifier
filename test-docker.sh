#!/bin/bash

# Quick Docker test script

echo "🧪 Testing Docker build and permission fix..."

# Build the image
echo "🔨 Building Docker image..."
docker build -t webhook-test .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker build successful"

# Test run the container
echo "🚀 Testing container startup..."
docker run --rm -d \
    --name webhook-test-container \
    -p 3001:3000 \
    -e NODE_ENV=production \
    -e SESSION_SECRET=test-secret-for-docker-test \
    -e DATABASE_PATH=/app/data/database.db \
    webhook-test

if [ $? -ne 0 ]; then
    echo "❌ Container startup failed"
    exit 1
fi

echo "⏳ Waiting for container to start..."
sleep 10

# Check container logs
echo "📋 Container logs:"
docker logs webhook-test-container

# Check if container is still running
if docker ps | grep -q webhook-test-container; then
    echo "✅ Container is running successfully"
    
    # Test HTTP endpoint
    echo "🌐 Testing HTTP endpoint..."
    if curl -f http://localhost:3001/ >/dev/null 2>&1; then
        echo "✅ HTTP endpoint is responding"
    else
        echo "⚠️  HTTP endpoint test failed (but container is running)"
    fi
else
    echo "❌ Container stopped unexpectedly"
fi

# Cleanup
echo "🧹 Cleaning up..."
docker stop webhook-test-container >/dev/null 2>&1
docker rmi webhook-test >/dev/null 2>&1

echo "🎉 Docker test completed"
