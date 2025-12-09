import { openDB } from 'idb'

export type Draft = {
  id: string
  key: string // 幂等 key
  createdAt: number
  fields: Record<string, any>
  photo?: Blob
  status: 'queued' | 'synced' | 'error'
}

const dbp = openDB('pwa-form', 1, { upgrade(db) { db.createObjectStore('drafts', { keyPath: 'id' }) } })

export const db = {
  put: async (d: Draft) => (await dbp).put('drafts', d),
  all: async () => (await dbp).getAll('drafts'),
  del: async (id: string) => (await dbp).delete('drafts', id)
}
