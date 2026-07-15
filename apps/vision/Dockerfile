# Pokemon Stock Radar - Vision Service
FROM python:3.13-slim

# System libraries required by opencv-python-headless (libGL, libglib) even in
# the headless build for some codecs / runtime deps.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the service.
RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

# Install dependencies first for better layer caching.
COPY pyproject.toml README.md ./
COPY app ./app

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

USER appuser

ENV PORT=8000
EXPOSE 8000

# Use shell form so $PORT expands at runtime (defaults to 8000).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
