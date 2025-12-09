import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool, ensureTable } from './_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureTable()
  const lim = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200)
  const { rows } = await pool.query(
    `SELECT id, idem, title, size, photo_mime, created_at
     FROM submissions
     ORDER BY created_at DESC
     LIMIT $1`,
    [lim]
  )
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.status(200).send(JSON.stringify({ ok: true, count: rows.length, items: rows }))
}
