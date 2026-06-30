FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-lock.txt requirements.txt .
RUN pip install --no-cache-dir --upgrade pip==24.2 setuptools==75.1.0 wheel==0.44.0 && \
    pip install --no-cache-dir --timeout 300 --retries 5 -r requirements-lock.txt

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN adduser --disabled-password --no-create-home --uid 10001 appuser

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

WORKDIR /app
COPY --chown=appuser:appuser . .

ENV PYTHONPATH="/app/src:/app"

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser

EXPOSE 9002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:9002/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
