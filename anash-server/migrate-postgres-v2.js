/**
 * Applies schema updates to an already-deployed Railway Postgres database.
 * Usage: node migrate-postgres-v2.js
 * Requires DATABASE_URL in .env
 */
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
    // Add PRIMARY KEY to users.id if not already set
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'users'::regclass AND contype = 'p'
            ) THEN
                ALTER TABLE users ADD PRIMARY KEY (id);
            END IF;
        END
        $$;
    `);
    console.log('users.id PRIMARY KEY: done');

    // Create user_logins table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_logins (
            id            BIGSERIAL    PRIMARY KEY,
            user_id       TEXT         NOT NULL REFERENCES users(id),
            logged_in_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            ip_address    INET,
            user_agent    TEXT,
            success       BOOLEAN      NOT NULL DEFAULT TRUE
        )
    `);
    console.log('user_logins table: done');

    // Create index for analytics queries
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_logins_user_id
        ON user_logins (user_id, logged_in_at DESC)
    `);
    console.log('idx_user_logins_user_id index: done');

    await pool.end();
    console.log('Migration complete.');
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
