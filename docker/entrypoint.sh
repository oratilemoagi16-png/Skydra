#!/bin/sh
set -e

# Start the Axum backend in the background
echo "Starting Skydra API server on port 3001..."
/app/skydra &

# Start nginx in the foreground
echo "Starting nginx on port 80..."
exec nginx -g 'daemon off;'
