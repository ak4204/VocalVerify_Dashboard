FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt

RUN pip install --no-cache-dir -r ./backend/requirements.txt

COPY app.py ./app.py
COPY backend ./backend
COPY out ./out
COPY ml ./ml
COPY dl ./dl

RUN mkdir -p /app/backend/data /app/vault_cache

EXPOSE 8080

CMD ["python", "app.py"]
