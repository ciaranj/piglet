#!/bin/sh
set -e

# Process nginx config template
envsubst '${MAX_UPLOAD_SIZE}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Ensure data directories exist
mkdir -p /data/sites /data/uploads

# Start nginx in background
nginx -g 'daemon off;' &

# Start Node.js server
cd /app/server
exec node server.js
