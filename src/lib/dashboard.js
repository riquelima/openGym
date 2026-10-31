// Dashboard analytics engine — Distilled from dashboard-design skill guidelines:
// Honest baselines, tabular figures, same-elapsed-time comparison windows, and quiet attention flags.

import { todayISO, fmtNum } from './format.js'
import { streakWeeks, lastBW, workoutVolume } from './history.js'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from './muscles.js'
import { EXIDX } from './exercises.js'
import { analyzeProgressionAndStalls } from './recommendations.js'

const DAY_MS = 86400000

/**
 * Round axis ticks covering max: 0, 500, 1k, 1.5k… (steps of 1, 2, 2.5 or 5 × 10^n).
 * From dashboard-design skill (snippets.md).
 */
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw) || (10 * pow)
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => +(i * step).toFixed(10))
}

/**
 * Computes honest delta between current and previous period.
 * Follows dashboard-design rule: tiny base (< min) reads "was X" in grey, avoiding noisy ±100% spikes.
 */
export function computeDelta({ cur, prev, min = 5, invert = false, vs = '' }) {
  if (prev == null || prev === undefined) return null
  if (prev === 0 && cur === 0) return { text: '±0%', pct: 0, status: 'neutral', was: null, vs }
  if (prev < min) {
    return {
      text: `era ${fmtNum(prev)}`,
      pct: null,
      status: 'neutral',
      was: prev,
      vs
    }
  }

  const d = ((cur - prev) / prev) * 100
  const r = Math.round(d)
  if (r === 0) {
    return { text: '±0%', pct: 0, status: 'neutral', was: null, vs }
  }

  const isGood = invert ? d < 0 : d > 0
  const absR = Math.abs(r)
  const sign = d > 0 ? '▲' : '▼'
  const text = Math.abs(d) > 999 ? (d > 0 ? '10×+' : '−99%') : `${sign} ${absR}%`

  return {
    text,
    pct: r,
    status: isGood ? 'up' : 'down',
    was: null,
    vs
  }
}

/**
 * Computes unified KPI metrics for the analytics dashboard with same-elapsed-time comparisons.
 */
export function computeDashboardKPIs(S, windowDays = 30) {
  const workouts = S.workouts || []
  const now = Date.now()
  const days = windowDays || 90 // 0 means all-time; use 90d for comparative delta

  const curStart = windowDays ? now - windowDays * DAY_MS : 0
  const prevStart = windowDays ? curStart - windowDays * DAY_MS : 0

  // Filter workouts into current vs previous comparison window
  const curWorkouts = workouts.filter(w => {
    const t = w.start || (w.d ? new Date(w.d + 'T12:00:00').getTime() : 0)
    return windowDays === 0 ? true : (t >= curStart && t <= now)
  })

  const prevWorkouts = windowDays === 0 ? [] : workouts.filter(w => {
    const t = w.start || (w.d ? new Date(w.d + 'T12:00:00').getTime() : 0)
    return t >= prevStart && t < curStart
  })

  // 1. Workouts count & delta
  const curWorkoutsCount = curWorkouts.length
  const prevWorkoutsCount = prevWorkouts.length
  const workoutsDelta = windowDays ? computeDelta({
    cur: curWorkoutsCount,
    prev: prevWorkoutsCount,
    min: 3,
    vs: `vs ${days}d ant.`
  }) : null

  // 2. Volume (Tonnage: sum(w * r))
  let curTonnage = 0
  curWorkouts.forEach(w => { curTonnage += workoutVolume(w) })

  let prevTonnage = 0
  prevWorkouts.forEach(w => { prevTonnage += workoutVolume(w) })

  const tonnageDelta = (windowDays && prevTonnage > 0) ? computeDelta({
    cur: curTonnage,
    prev: prevTonnage,
    min: 50,
    vs: `vs ${days}d ant.`
  }) : null

  const avgTonnagePerSession = curWorkoutsCount ? Math.round(curTonnage / curWorkoutsCount) : 0

  // 3. Streak & Frequency
  const streak = streakWeeks(S)
  const plannedWeekly = Object.keys(S.week || {}).filter(k => S.week[k]).length || 4

  // 4. Body Weight & Target
  const bw = lastBW(S)
  const bwList = S.bodyweight || []
  let bw30dDelta = null
  if (bwList.length >= 2) {
    const p30 = bwList.slice().reverse().find(b => {
      const d = (now - (b.t || new Date(b.d).getTime())) / DAY_MS
      return d >= 20 && d <= 45
    })
    if (p30 && bw) {
      bw30dDelta = Number((bw.w - p30.w).toFixed(1))
    }
  }

  const targetW = S.targetW ? Number(S.targetW) : null
  let targetGap = null
  if (targetW && bw) {
    targetGap = Number((targetW - bw.w).toFixed(1))
  }

  return {
    windowDays,
    workouts: {
      count: curWorkoutsCount,
      delta: workoutsDelta,
      baseline: windowDays ? `${days} dias` : 'Todo o período'
    },
    tonnage: {
      total: curTonnage,
      avg: avgTonnagePerSession,
      delta: tonnageDelta,
      unit: S.unit || 'kg'
    },
    streak: {
      weeks: streak,
      plannedWeekly,
      active: streak > 0
    },
    bodyweight: {
      current: bw ? Number(bw.w) : null,
      delta30d: bw30dDelta,
      target: targetW,
      gap: targetGap,
      unit: S.unit || 'kg'
    }
  }
}

/**
 * Attention flags (Monitor: "overview → what needs attention → closer look → act").
 * Returns at most 2-3 salient issues with action buttons beside them.
 */
export function computeDashboardAttention(S) {
  const items = []
  const now = Date.now()

  // 1. Missing weigh-in (over 5 days)
  const bw = lastBW(S)
  if (!bw) {
    items.push({
      id: 'bw-empty',
      type: 'warn',
      icon: 'scale',
      title: 'Peso corporal',
      desc: 'Nenhum peso registrado ainda',
      actionLabel: 'Registrar',
      action: 'bwSheet'
    })
  } else {
    const daysSince = Math.round((now - (bw.t || new Date(bw.d).getTime())) / DAY_MS)
    if (daysSince >= 6) {
      items.push({
        id: 'bw-overdue',
        type: 'warn',
        icon: 'scale',
        title: 'Pesagem desatualizada',
        desc: `Último registro há ${daysSince} dias`,
        actionLabel: 'Atualizar',
        action: 'bwSheet'
      })
    }
  }

  // 2. Neglected muscles in recent workouts
  const recentWorkouts = (S.workouts || []).slice(-8)
  if (recentWorkouts.length >= 3) {
    const load = loadOfWorkouts(recentWorkouts)
    const { missed, worked } = rankOf(load)
    const criticalMissed = missed.filter(m => m !== 'tibialis' && m !== 'serratus').slice(0, 2)
    if (criticalMissed.length > 0) {
      const names = criticalMissed.map(m => MUSCLE_NAME[m] || m).join(' e ')
      items.push({
        id: 'muscles-neglected',
        type: 'attention',
        icon: 'figureStrength',
        title: 'Equilíbrio muscular',
        desc: `${names} sem estímulo nas últimas sessões`,
        actionLabel: 'Ver rotina',
        action: 'navPlan'
      })
    }
  }

  // 3. Stalled exercise progression
  const { stalledExercise } = analyzeProgressionAndStalls(S)
  if (stalledExercise) {
    items.push({
      id: 'exercise-stalled',
      type: 'info',
      icon: 'dumbbell',
      title: `Platô em ${stalledExercise.name}`,
      desc: `Carga travada em ${stalledExercise.weight} ${S.unit || 'kg'}`,
      actionLabel: 'Exercícios',
      action: 'navLibrary'
    })
  }

  return items.slice(0, 3)
}
