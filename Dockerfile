FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Render automatically injects its own PORT variable (defaults to 10000)
ENV PORT=10000
# Prevent ONNX/OpenBLAS memory spikes (OOM kills) on Render free tier
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1

WORKDIR /app

# Install ffmpeg AND libsndfile1 (required for librosa and soundfile audio processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt

RUN pip install --no-cache-dir -r ./backend/requirements.txt

COPY app.py ./app.py
COPY backend ./backend
COPY out ./out
COPY ml ./ml
COPY dl ./dl

RUN mkdir -p /app/backend/data /app/vault_cache

EXPOSE 10000

CMD ["python", "app.py"]
