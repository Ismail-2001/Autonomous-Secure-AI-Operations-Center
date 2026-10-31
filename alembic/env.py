import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from src.asoc.core.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Ensure runtime DATABASE_URL is respected and asyncpg is stripped for sync Alembic
env_db_url = os.getenv("DATABASE_URL")
if env_db_url:
    if "+asyncpg" in env_db_url:
        env_db_url = env_db_url.replace("+asyncpg", "")
    config.set_main_option("sqlalchemy.url", env_db_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    if url and "+asyncpg" in url:
        url = url.replace("+asyncpg", "")
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = config.get_main_option("sqlalchemy.url")
    if url and "+asyncpg" in url:
        url = url.replace("+asyncpg", "")
        config.set_main_option("sqlalchemy.url", url)

    configuration = config.get_section(config.config_ini_section, {})
    if url:
        configuration["sqlalchemy.url"] = url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
