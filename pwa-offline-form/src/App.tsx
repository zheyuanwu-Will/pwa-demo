// 顶部 import 维持不变
import { useEffect, useState } from 'react'
import { db } from './db'
import type { Draft } from './db'

// ===== 新增：类型和状态 =====
type SyncedItem = {
  id: number
  idem: string
  title: string | null
  size: number | null
  photo_mime: string | null
  created_at: string
}

const uuid = () => crypto.randomUUID?.() || String(Date.now())

async function flushOutbox() {
  const drafts = await db.all()
  for (const d of drafts) {
    if (d.status !== 'queued') continue

    const fd = new FormData()
    fd.set('title', d.fields.title)
    if (d.photo) fd.set('photo', d.photo, 'photo.jpg')

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': d.key },
        body: fd
      })
      if (!res.ok) throw new Error(String(res.status))
      await db.del(d.id)
    } catch (e) {
      // 留在队列，等待下次 flush
      console.log('[flushOutbox] failed', e)
    }
  }
}

// ===== 新增：拉取已同步列表 =====
async function fetchSynced(limit = 50): Promise<SyncedItem[]> {
  const r = await fetch(`/api/list?limit=${limit}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  return data.items as SyncedItem[]
}

export default function App() {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])

  // ===== 新增：展示“已同步”相关状态 =====
  const [showSynced, setShowSynced] = useState(false)
  const [synced, setSynced] = useState<SyncedItem[]>([])
  const [loadingSynced, setLoadingSynced] = useState(false)

  useEffect(() => { db.all().then(setDrafts) }, [])

  useEffect(() => {
    const flush = () =>
      flushOutbox().catch(() => {}).then(() => db.all().then(setDrafts))

    window.addEventListener('online', flush)
    window.addEventListener('focus', flush)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) flush() })

    const timer = setInterval(flush, 15000)
    // @ts-ignore 申请持久化（可选）
    navigator.storage?.persist?.()

    return () => {
      window.removeEventListener('online', flush)
      window.removeEventListener('focus', flush)
      clearInterval(timer)
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const key = uuid()
    const fd = new FormData()
    fd.set('title', title)
    if (file) fd.set('photo', file.name ? file : new File([file], 'photo.jpg'))

    try {
      const res = await fetch('/api/submit', { method: 'POST', headers: { 'X-Idempotency-Key': key }, body: fd })
      if (!res.ok) throw new Error(String(res.status))
      alert('在线提交成功')
      // 提交成功后刷新“已同步”面板（如果已展开）
      if (showSynced) reloadSynced()
    } catch {
      await db.put({ id: uuid(), key, createdAt: Date.now(), fields: { title }, photo: file || undefined, status: 'queued' })
      setDrafts(await db.all())
      alert('离线保存，网络恢复后自动同步')
    }
    setTitle(''); setFile(null)
    ;(document.getElementById('photo') as HTMLInputElement).value = ''
  }

  // ===== 新增：按钮触发加载/刷新已同步 =====
  async function reloadSynced() {
    try {
      setLoadingSynced(true)
      const items = await fetchSynced(50)
      setSynced(items)
    } finally {
      setLoadingSynced(false)
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>离线表单 + 拍照 Demo</h1>

      <form onSubmit={onSubmit}>
        <input placeholder="标题" value={title} onChange={e=>setTitle(e.target.value)} required/><br/><br/>
        <input id="photo" type="file" accept="image/*" capture="environment"
               onChange={e=>setFile(e.target.files?.[0]||null)} /><br/><br/>
        <button type="submit">提交</button>
      </form>

      <hr/>
      <h3>待同步草稿</h3>
      <ul>{drafts.map(d => <li key={d.id}>{new Date(d.createdAt).toLocaleString()} — {d.fields.title}</li>)}</ul>

      <hr/>
      {/* ===== 新增：已同步面板按钮与内容 ===== */}
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <button
          onClick={async () => {
            const next = !showSynced
            setShowSynced(next)
            if (next) await reloadSynced()
          }}
        >
          {showSynced ? '收起已同步' : '查看已同步'}
        </button>
        {showSynced && (
          <button onClick={reloadSynced} disabled={loadingSynced}>
            {loadingSynced ? '刷新中…' : '刷新'}
          </button>
        )}
        {showSynced && <small style={{opacity:.7}}>（最近 50 条）</small>}
      </div>

      {showSynced && (
        <div style={{marginTop:12}}>
          {loadingSynced && <p>加载中…</p>}
          {!loadingSynced && synced.length === 0 && <p>暂无已同步记录</p>}
          {!loadingSynced && synced.length > 0 && (
            <ul>
              {synced.map(it => (
                <li key={it.id}>
                  {new Date(it.created_at).toLocaleString()} — {it.title || '(无标题)'}
                  {it.photo_mime ? (
                    <> — <a href={`/api/photo?id=${it.id}`} target="_blank" rel="noreferrer">查看图片</a></>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  )
}

