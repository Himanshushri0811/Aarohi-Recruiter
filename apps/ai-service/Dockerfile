# ==============================================================================
# Aarohi AI Recruiter Service - Production Containerfile
# ==============================================================================

# Stage 1: Build stage
FROM python:3.13-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Production runtime stage
FROM python:3.13-slim AS runtime

WORKDIR /app

# Install runtime dependencies & curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN groupadd -r aarohi && useradd -r -g aarohi -u 1001 -m -s /bin/bash aarohi

# Copy python packages installed in user dir from builder
COPY --from=builder /root/.local /home/aarohi/.local
ENV PATH=/home/aarohi/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application source code
COPY --chown=aarohi:aarohi app /app/app
COPY --chown=aarohi:aarohi pyproject.toml /app/

USER aarohi

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f "http://localhost:${PORT:-8000}/health/live" || exit 1

ENTRYPOINT ["/bin/sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --workers 2"]
