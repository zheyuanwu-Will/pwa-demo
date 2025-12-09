import { createRoot } from 'react-dom/client'
import App from './App'
import { Workbox } from 'workbox-window'

createRoot(document.getElementById('root')!).render(<App />)

if ('serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js')
  wb.register()
}

