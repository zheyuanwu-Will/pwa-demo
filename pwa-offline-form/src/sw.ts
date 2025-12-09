/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'

// @ts-ignore 由 vite-plugin-pwa 注入
precacheAndRoute(self.__WB_MANIFEST || [])

// App 壳 & 资源缓存
registerRoute(({request}) => request.mode === 'navigate', new NetworkFirst())
registerRoute(({request}) => ['script','style','image','font'].includes(request.destination), new StaleWhileRevalidate())

// 断网时把 /api/submit 的 POST 入队，联网后自动重放
const bgSync = new BackgroundSyncPlugin('formQueue', { maxRetentionTime: 24*60 })
registerRoute(
  ({url, request}) => url.pathname.startsWith('/api/submit') && request.method === 'POST',
  new NetworkOnly({ plugins: [bgSync] }),
  'POST'
)

export {}
