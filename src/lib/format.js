// Formatting + date helpers (ported from the vanilla app, unit taken from the store where needed).
import { dateLocale, t } from './i18n.js'
export const todayISO = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
export const isoOf = d =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

export const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function fmtDate(iso, long) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString(dateLocale(), long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })
}
export function fmtDur(ms) {
  const m = Math.floor(ms / 60000)
  return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min'
}
// Imported history has no clock — an unknown duration is left out rather than shown as "0 min".
export const durPart = ms => (ms >= 60000 ? [fmtDur(ms)] : [])
// Numbers follow the UI language, like the dates above — a hardcoded locale put Swiss
// apostrophes ("7'535 kg") in front of every user, in every language.
export const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString(dateLocale())
// Volume stays in the profile's unit throughout: the old shorthand turned anything over
// 10 000 into "t", which is wrong for a pound profile and made one list mix "18.8t" with
// "7'535 kg" — two numbers you can't compare at a glance.
export const fmtVol = (v, unit) => fmtNum(v) + ' ' + unit
// Plural forms are not automatic when the English string is the key.
export const exCount = n => t(n === 1 ? '{0} exercise' : '{0} exercises', n)

export function weekKey(d) {
  const dt = new Date(d + 'T12:00:00')
  const day = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - day + 3)
  const jan4 = new Date(dt.getFullYear(), 0, 4)
  const week = 1 + Math.round(((dt - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
  return dt.getFullYear() + '-' + week
}

export const localTZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } }

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export const ACCENTS = {
  lime: { dark: '#E2F163', light: '#16A34A', name: 'Lima' },
  emerald: { dark: '#10B981', light: '#059669', name: 'Esmeralda' },
  teal: { dark: '#2DD4BF', light: '#0D9488', name: 'Verde Água' },
  cyan: { dark: '#00E5FF', light: '#0284C7', name: 'Ciano' },
  sky: { dark: '#38BDF8', light: '#0284C7', name: 'Celeste' },
  blue: { dark: '#3B82F6', light: '#2563EB', name: 'Azul' },
  indigo: { dark: '#818CF8', light: '#4F46E5', name: 'Índigo' },
  violet: { dark: '#896CFE', light: '#7C3AED', name: 'Violeta' },
  purple: { dark: '#C084FC', light: '#9333EA', name: 'Roxo' },
  fuchsia: { dark: '#F43F5E', light: '#E11D48', name: 'Fúcsia' },
  pink: { dark: '#FF375F', light: '#E11D48', name: 'Rosa' },
  rose: { dark: '#FB7185', light: '#BE123C', name: 'Rose' },
  red: { dark: '#EF4444', light: '#DC2626', name: 'Vermelho' },
  orange: { dark: '#FF7A00', light: '#EA580C', name: 'Laranja' },
  amber: { dark: '#FBBF24', light: '#D97706', name: 'Âmbar' },
  gold: { dark: '#FCD34D', light: '#B45309', name: 'Dourado' },
  lavender: { dark: '#896CFE', light: '#7C3AED', name: 'Lavanda' }
}
