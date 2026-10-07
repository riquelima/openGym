import { EXDB } from './exercises-data.js'
import { t } from './i18n.js'

export { EXDB }
export const EXIDX = {}
EXDB.forEach(e => { EXIDX[e.id] = e })
export const BODYPARTS = [...new Set(EXDB.map(e => e.bp))].sort()

export const GYM_MACHINE_EQUIPMENTS = [
  'leverage machine',
  'cable',
  'smith machine',
  'sled machine',
  'elliptical machine',
  'skierg machine',
  'stepmill machine',
  'stationary bike',
  'upper body ergometer'
]

export function isGymMachine(eq) {
  if (!eq) return false
  const l = String(eq).toLowerCase().trim()
  if (GYM_MACHINE_EQUIPMENTS.includes(l)) return true
  if (
    l.includes('machine') ||
    l.includes('máquina') ||
    l.includes('cable') ||
    l.includes('cabo') ||
    l.includes('polia') ||
    l.includes('sled') ||
    l.includes('trenó') ||
    l.includes('alavanca') ||
    l.includes('ergometer') ||
    l.includes('ergômetro')
  ) {
    return true
  }
  return false
}

// Equipment options present in a given list of exercises, most common first (issue #6).
// Deriving them from the *already filtered* list keeps the chip row short and means
// every body-part × equipment combination on screen has results behind it.
export function equipmentOf(list) {
  const c = {}
  list.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  return Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
}

// Custom (user-created) exercises live in synced state S.customEx (issue #11) and are
// merged into the id index here so every EXIDX[id] lookup keeps working unchanged.
let customIds = []
export function registerCustom(list) {
  customIds.forEach(id => delete EXIDX[id])
  customIds = (list || []).map(e => e.id)
  ;(list || []).forEach(e => { EXIDX[e.id] = e })
}
// Full searchable catalogue — customs first so your own exercises are easy to find.
export const allExercises = st => [...(st.customEx || []), ...EXDB]

// Media normally sits next to the app (img/ and gif/, mounted into the web container).
// A build can point them somewhere else — the demo build pulls them off a CDN instead of
// shipping ~140 MB of images into the deployment.
// Verified ExerciseDB CDN bases for instant loading across dev and production
const DEFAULT_IMG_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/'
const DEFAULT_GIF_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/'

const IMG_BASE = import.meta.env.VITE_IMG_BASE || DEFAULT_IMG_BASE
const GIF_BASE = import.meta.env.VITE_GIF_BASE || DEFAULT_GIF_BASE

export const imgSrc = ex => {
  if (!ex) return ''
  const src = ex.img || ex.imageUrl || ex.imageUrls?.['720p'] || ex.imageUrls?.['480p'] || ex.imageUrls?.['360p']
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('data:')) return src
  return IMG_BASE + src
}

export const gifSrc = ex => {
  if (!ex) return ''
  const src = ex.gif || ex.gifUrl
  if (!src) return ''
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) return src
  return GIF_BASE + src
}

export const videoSrc = ex => {
  if (!ex) return ''
  const v = ex.video || ex.videoUrl
  if (!v) return ''
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('blob:')) return v
  return `https://cdn.exercisedb.dev/videos/${v}`
}

export const isExerciseDB = ex => true

// Cardio exercises log time + speed instead of weight × reps.
export const isCardio = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.bp === 'cardio'

// An id that resolves to nothing — a plan file built against a different exercise dataset,
// a custom exercise deleted on another device before the sync arrived — still has to
// render. A placeholder keeps it visible (and removable) instead of taking the whole view
// down on the first `ex.n`.
export const exOr = id => EXIDX[id] ||
  { id, n: t('Unknown exercise'), bp: '', tg: '', eq: '', sm: [], st: [], missing: true }
