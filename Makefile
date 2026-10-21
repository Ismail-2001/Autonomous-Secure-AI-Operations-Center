.PHONY: install dev test lint format clean run docker-up docker-down monitor ci

# ── Development ──

install:
	pip install -e ".[dev]"

dev:
	uvicorn src.asoc.api.app:app --reload --host 0.0.0.0 --port 9002

run:
	uvicorn src.asoc.api.app:app --host 0.0.0.0 --port 9002 --workers 2

simulate:
	python main.py

# ── Testing ──

test:
	python -m pytest tests/ -v --tb=short -W ignore

test-cov:
	python -m pytest tests/ --cov=src --cov-report=term-missing --cov-report=html -W ignore

# ── Linting & Formatting ──

lint:
	black --check --diff src/ tests/ api.py main.py
	isort --check-only --profile black src/ tests/ api.py main.py
	autoflake --check-diff --remove-all-unused-imports -r src/ tests/

format:
	black src/ tests/ api.py main.py && isort --profile black src/ tests/ api.py main.py
	autoflake --remove-all-unused-imports -r src/ tests/ --in-place

# ── Docker ──

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-monitor:
	docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# ── Database ──

migrate:
	alembic upgrade head

migrate-rollback:
	alembic downgrade -1

# ── Cleanup ──

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov

# ── CI ──

ci: format lint test
	@echo "All CI checks passed."
