"""Migration 003: Add alert triage workflow columns to incidents."""

import asyncio

import asyncpg

DATABASE_URL = "postgresql://asoc_user:changeme123@postgres:5432/asoc_db"

MIGRATION_SQL = """
ALTER TABLE incidents
    ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS triage_status VARCHAR(30) NOT NULL DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS triaged_by VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS response_actions JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS evidence_links JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_incidents_triage ON incidents(triage_status);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to);
"""


async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(MIGRATION_SQL)
        print("Migration 003 complete: triage columns added to incidents")

        # Verify columns exist
        cols = await conn.fetch("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'incidents' ORDER BY ordinal_position
        """)
        print(f"Incidents columns: {[c['column_name'] for c in cols]}")
    finally:
        await conn.close()


asyncio.run(main())
