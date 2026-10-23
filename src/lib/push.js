// Web Push subscribe/unsubscribe — requires a signed-in profile (subscriptions are stored
// server-side per user, same as everything else under /api).
import { api } from './api.js'

export const pushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window

export const pushPermission = () => (pushSupported() ? Notification.permission : 'unsupported')

export const urlBase64ToUint8Array = b64 => {
  if (!b64 || typeof b64 !== 'string') {
    throw new Error('Chave pública VAPID não encontrada no servidor.')
  }
  const clean = b64.trim().replace(/\s+/g, '')
  if (!clean) {
    throw new Error('Chave pública VAPID vazia no servidor.')
  }
  const padding = '='.repeat((4 - (clean.length % 4)) % 4)
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i)
  }
  if (output.length !== 65 || output[0] !== 4) {
    throw new Error(`applicationServerKey inválida: esperado 65 bytes P-256 (prefixo 0x04), recebido ${output.length} bytes (prefixo ${output[0]}).`)
  }
  return output
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Notificações push não são suportadas neste navegador.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permissão de notificações não foi concedida.')
  const reg = await navigator.serviceWorker.ready

  // Unsubscribe previous subscription if one exists (prevents VAPID key mismatch on iOS/WebKit)
  try {
    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()
  } catch {
    // Ignore unsubscribe error
  }

  const res = await api('/api/push/public-key')
  const key = res?.key
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error('Chave VAPID não configurada no servidor (VAPID_PUBLIC_KEY ausente).')
  }

  const appServerKey = urlBase64ToUint8Array(key)
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appServerKey
  })
  await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) })
}

export async function disablePush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await sub.unsubscribe()
  await api('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
}

export const sendTestPush = () => api('/api/push/test', { method: 'POST', body: '{}' })
