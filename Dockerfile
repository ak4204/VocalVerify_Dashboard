# ==============================================================================
# VocalVerify - Hugging Face Spaces Unified Dockerfile
# Combines Next.js Frontend + FastAPI Dual-Stream Inference Engine + Nginx Proxy
# ==============================================================================

FROM python:3.11-slim-bookworm

# Avoid interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# 1. Install system dependencies (FFmpeg for audio, Nginx for proxying port 7860)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    ffmpeg \
    nginx \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Node.js 20.x LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# 3. Create Hugging Face Space user (UID 1000)
RUN useradd -m -u 1000 user
WORKDIR /app

# 4. Install Python backend dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 5. Install Node.js dependencies
COPY package.json package-lock.json* /app/
RUN npm ci || npm install

# 6. Copy entire workspace
COPY . /app

# 7. Build Next.js production bundle
RUN npm run build

# 8. Create runtime directories and set ownership for Hugging Face user
RUN mkdir -p /app/vault_cache /app/backend/vault_cache /app/backend/data /tmp/nginx /var/log/nginx /var/lib/nginx \
    && chown -R user:user /app /tmp /var/log/nginx /var/lib/nginx \
    && chmod +x /app/start.sh

# Switch to non-root Hugging Face user
USER user

# 9. Expose Hugging Face Space single port (7860)
ENV PORT=7860
EXPOSE 7860

# Start FastAPI, Next.js, and Nginx
CMD ["/app/start.sh"]
