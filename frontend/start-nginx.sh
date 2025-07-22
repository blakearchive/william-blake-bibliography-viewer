#!/bin/sh

# Custom nginx startup script for OpenShift compatibility
# Bypasses PID file creation entirely

echo "Starting nginx with OpenShift-compatible configuration..."

# Start nginx in foreground without daemon mode
exec nginx -g "daemon off;"
