// api/_db.ts
import { Pool } from 'pg'

const connectionString =
  process.env.DATABASE_URL || process.env.NEON_DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Add it in Vercel → Settings → Environment Variables')
}

export const pool = new Pool({
  connectionString,
  // serverless 场景建议加上：
  max: 5, // 连接池大小
  idleTimeoutMillis: 30_000
})

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      idem TEXT UNIQUE NOT NULL,
      title TEXT,
      photo BYTEA,
      photo_mime TEXT,
      size INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
}
