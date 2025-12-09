import type { VercelRequest, VercelResponse } from '@vercel/node'
import formidable from 'formidable'
import { readFile } from 'node:fs/promises'
import { pool, ensureTable } from './_db'

export const config = { api: { bodyParser: false } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const idem = String(req.headers['x-idempotency-key'] || '')
  if (!idem) return res.status(400).json({ ok: false, err: 'missing X-Idempotency-Key' })

  await ensureTable()

  const form = formidable({ multiples: false })
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ ok: false, err: String(err) })

    const client = await pool.connect()
    try {
      const title = String(fields.title ?? '')

      let photoBuf: Buffer | null = null
      let mime = ''
      let size = 0

      const pf: any = (files as any).photo
      if (pf?.filepath) {
        const buf = await readFile(pf.filepath)
        // 演示：限制 5MB，超过不存（可改）
        if (buf.length <= 5 * 1024 * 1024) {
          photoBuf = buf
          mime = pf.mimetype || 'image/jpeg'
          size = pf.size || buf.length
        }
      }

      const { rows } = await client.query(
        `
        INSERT INTO submissions (idem, title, photo, photo_mime, size)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (idem) DO UPDATE
          SET title = EXCLUDED.title,
              photo = COALESCE(EXCLUDED.photo, submissions.photo),
              photo_mime = COALESCE(EXCLUDED.photo_mime, submissions.photo_mime),
              size = COALESCE(EXCLUDED.size, submissions.size)
        RETURNING id, created_at
        `,
        [idem, title, photoBuf, mime, size]
      )

      const row = rows[0]
      return res.status(200).json({ ok: true, id: row.id, receivedAt: row.created_at })
    } catch (e: any) {
      console.error('SUBMIT_ERROR', e)
      return res.status(500).json({ ok: false, err: e?.message || String(e) })
    } finally {
      client.release()
    }
  })
}
