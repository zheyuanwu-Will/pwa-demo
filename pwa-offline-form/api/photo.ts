import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pool } from './_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = Number(req.query.id)
  if (!id) return res.status(400).send('id required')

  const { rows } = await pool.query(
    `SELECT photo, photo_mime FROM submissions WHERE id = $1`,
    [id]
  )
  const row = rows[0]
  if (!row || !row.photo) return res.status(404).send('not found')

  res.setHeader('content-type', row.photo_mime || 'application/octet-stream')
  res.send(Buffer.from(row.photo))
}
