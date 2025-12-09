import type { VercelRequest, VercelResponse } from '@vercel/node'
import formidable from 'formidable'

export const config = { api: { bodyParser: false } }

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const idem = (req.headers['x-idempotency-key'] || '').toString()

  const form = formidable({ multiples: false })
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(400).json({ ok:false, err:String(err) })
    // 演示用：不保存，直接回显。真实项目这里写入存储/数据库，并对 idem 做去重。
    return res.status(200).json({ ok:true, idempotencyKey: idem, fields, file: !!files.photo })
  })
}
