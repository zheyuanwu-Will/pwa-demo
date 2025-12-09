import { useEffect, useState } from 'react'
import { db } from './db'
import type { Draft } from './db'


const uuid = () => crypto.randomUUID?.() || String(Date.now())

async function flushOutbox() {
  const drafts = await db.all()
  for (const d of drafts) {
    if (d.status !== 'queued') continue
    const fd = new FormData()
    fd.set('title', d.fields.title)
    if (d.photo) fd.set('photo', d.photo, 'photo.jpg')
    try {
      const res = await fetch('/api/submit', { method: 'POST', headers: {'X-Idempotency-Key': d.key}, body: fd })
      if (res.ok) await db.del(d.id)
    } catch { /* 仍失败则保留，下次再试 */ }
  }
}

export default function App() {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])

  useEffect(() => { db.all().then(setDrafts) }, [])
  useEffect(() => {
    const onOnline = () => { flushOutbox().then(()=>db.all().then(setDrafts)) }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) onOnline() })
    return () => window.removeEventListener('online', onOnline)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const key = uuid()
    const fd = new FormData()
    fd.set('title', title)
    if (file) fd.set('photo', file, file.name)

    try {
      const res = await fetch('/api/submit', { method: 'POST', headers: {'X-Idempotency-Key': key}, body: fd })
      if (!res.ok) throw new Error(String(res.status))
      alert('在线提交成功')
    } catch {
      const draft: Draft = { id: uuid(), key, createdAt: Date.now(), fields: { title }, photo: file || undefined, status: 'queued' }
      await db.put(draft)
      setDrafts(await db.all())
      alert('离线保存，网络恢复后自动同步')
      flushOutbox().then(async()=>setDrafts(await db.all())) // 兜底，iOS 无 BG Sync
    }
    setTitle(''); setFile(null)
    ;(document.getElementById('photo') as HTMLInputElement).value = ''
  }

  return (
    <main style={{maxWidth:640,margin:'40px auto',fontFamily:'system-ui'}}>
      <h1>离线表单 + 拍照 Demo</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="标题" value={title} onChange={e=>setTitle(e.target.value)} required/><br/><br/>
        <input id="photo" type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/><br/><br/>
        <button type="submit">提交</button>
      </form>
      <hr/>
      <h3>待同步草稿</h3>
      <ul>{drafts.map(d=><li key={d.id}>{new Date(d.createdAt).toLocaleString()} — {d.fields.title}</li>)}</ul>
    </main>
  )
}
