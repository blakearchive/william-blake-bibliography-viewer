#!/bin/bash

echo "Testing nginx configuration locally..."

# Test the Docker image locally
echo "Starting local container to test nginx configuration..."
docker run -d --name test-blake-frontend -p 8080:8080 grantglass/blake-pdf-frontend:latest

# Wait a moment for container to start
sleep 5

echo "Testing endpoints..."

# Test root path
echo "Testing GET /"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/

# Test React Router path
echo "Testing GET /search (React Router)"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/search

# Test static asset
echo "Testing static asset"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/static/js/main.d29f1e99.js

# Check container logs for errors
echo "Container logs:"
docker logs test-blake-frontend 2>&1 | head -20

# Cleanup
echo "Stopping test container..."
docker stop test-blake-frontend && docker rm test-blake-frontend

echo "Local test completed!"
