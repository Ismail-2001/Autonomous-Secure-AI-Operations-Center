# A-SOC Project Conventions

## Import Style
- Use **absolute imports** everywhere (e.g., `from agents.base.message import ASOCMessage`)
- No relative imports (`from ..base.message`)

## Async Patterns
- All I/O must be async (use `aiofiles` for file ops, `httpx.AsyncClient` for HTTP)
- Use `asyncio.Lock` for shared state, not threading primitives
- Agent `process_message()` must be `async def`

## Type Annotations
- All functions must have typed parameters and return types
- Use `Optional[T]` for nullable values
- Use Pydantic `SecretStr` for API keys and secrets

## Testing
- Framework: `pytest` + `pytest-asyncio`
- Convention: `tests/test_*.py`
- Async tests must use `@pytest.mark.asyncio`
- Target coverage: >= 90%

## Linting & Formatting
- `black --line-length 120` (all Python)
- `isort --profile black` (import sorting)
- `autoflake --remove-all-unused-imports` (dead code)

## Port Conventions
| Service | Port |
|---------|------|
| Backend API | 9002 |
| Frontend | 3000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| OPA | 8181 |

## WebSocket Protocol
- Endpoint: `/ws/threat-feed?token=<WS_API_TOKEN>`
- Client commands: `START_SIMULATION`, `APPROVE_ACTION`, `STOP_SIMULATION`
- Server events: `APPROVAL_REQUIRED`, `BLAST_RADIUS_UPDATE`
- Rate limit: 10 messages per 10 seconds per connection
