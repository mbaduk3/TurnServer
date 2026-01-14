#!/bin/bash

# Docker build and test script for TurnServer
# Usage: ./docker-build-test.sh [tag]

set -e

TAG="${1:-latest}"
IMAGE_NAME="turnserver:${TAG}"

echo "🔨 Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo ""
echo "✅ Image built successfully!"
echo ""
echo "🚀 Starting container..."

CONTAINER_ID=$(docker run -d -p 8080:8080 "$IMAGE_NAME")

echo "📦 Container started with ID: $CONTAINER_ID"
echo "🌐 Server should be accessible at: ws://localhost:8080"
echo ""
echo "To view logs, run:"
echo "  docker logs -f $CONTAINER_ID"
echo ""
echo "To stop the container, run:"
echo "  docker stop $CONTAINER_ID"
echo ""
echo "Waiting 5 seconds before showing logs..."
sleep 5

docker logs "$CONTAINER_ID"
