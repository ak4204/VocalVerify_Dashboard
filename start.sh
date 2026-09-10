#!/usr/bin/env bash
set -e

echo "=================================================="
echo "Starting VocalVerify Dashboard on Hugging Face..."
echo "=================================================="

# Ensure temp directories exist for nginx
mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp
mkdir -p /app/backend/data /app/vault_cache /app/backend/vault_cache

# Start FastAPI backend in background on port 8000
echo "Starting FastAPI Detection Engine on port 8000..."
export PYTHONPATH="/app:/app/backend:$PYTHONPATH"
cd /app/backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Start Next.js frontend in background on port 3000
echo "Starting Next.js Frontend on port 3000..."
cd /app
npm start -- -p 3000 &
FRONTEND_PID=$!

# Wait briefly for backends to initialize
sleep 3

# Start Nginx in foreground on port 7860 (Hugging Face default)
echo "Starting Nginx reverse proxy on port 7860..."
nginx -g "daemon off;" -c /app/nginx.conf
