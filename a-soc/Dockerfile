FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc=4:12.2.0-3 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-lock.txt requirements.txt .
RUN pip install --no-cache-dir --upgrade pip==24.2 setuptools==75.1.0 wheel==0.44.0 && \
    pip install --no-cache-dir -r requirements-lock.txt

FROM python:3.12-slim

RUN adduser --disabled-password --no-create-home --uid 10001 appuser

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

WORKDIR /app
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 9002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:9002/health || exit 1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "9002", "--workers", "2", "--limit-concurrency", "100"]
