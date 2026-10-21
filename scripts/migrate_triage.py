import asyncio

import asyncpg


async def main():
    conn = await asyncpg.connect("postgresql://asoc_user:changeme123@postgres:5432/asoc_db")
    sql = [
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100) DEFAULT NULL",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS triage_status VARCHAR(30) NOT NULL DEFAULT 'new'",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS triaged_by VARCHAR(100) DEFAULT NULL",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ DEFAULT NULL",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS response_actions JSONB NOT NULL DEFAULT '[]'",
        "ALTER TABLE incidents ADD COLUMN IF NOT EXISTS evidence_links JSONB NOT NULL DEFAULT '[]'",
    ]
    for s in sql:
        await conn.execute(s)
        print(f"OK: {s.split('IF NOT EXISTS ')[1].split(' ')[0]}")
    try:
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_incidents_triage ON incidents(triage_status)")
        print("OK: idx_incidents_triage")
    except Exception as e:
        print(f"Index exists: {e}")
    try:
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to)")
        print("OK: idx_incidents_assigned")
    except Exception as e:
        print(f"Index exists: {e}")
    cols = await conn.fetch(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'incidents' ORDER BY ordinal_position"
    )
    print("Final columns:", [c["column_name"] for c in cols])
    await conn.close()


asyncio.run(main())
