import { describe, it, expect } from 'vitest'
import {
  niceTicks,
  computeDelta,
  computeDashboardKPIs,
  computeDashboardAttention
} from './dashboard.js'

describe('dashboard analytics engine', () => {
  it('computes nice round ticks for chart axes', () => {
    expect(niceTicks(0)).toEqual([0])
    expect(niceTicks(100, 4)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(85, 4)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(1200, 4)).toEqual([0, 500, 1000, 1500])
  })

  it('computes honest deltas without noise', () => {
    // Zero baseline
    expect(computeDelta({ cur: 0, prev: 0 })).toEqual({ text: '±0%', pct: 0, status: 'neutral', was: null, vs: '' })

    // Tiny base (< 5 by default) reads "era X" in neutral grey
    const tiny = computeDelta({ cur: 0, prev: 1 })
    expect(tiny.text).toBe('era 1')
    expect(tiny.status).toBe('neutral')

    // Valid positive change
    const up = computeDelta({ cur: 15, prev: 10, vs: 'vs mês ant.' })
    expect(up.text).toBe('▲ 50%')
    expect(up.pct).toBe(50)
    expect(up.status).toBe('up')
    expect(up.vs).toBe('vs mês ant.')

    // Valid inverted change (e.g. body fat or duration)
    const inv = computeDelta({ cur: 8, prev: 10, invert: true })
    expect(inv.text).toBe('▼ 20%')
    expect(inv.status).toBe('up') // lower is good when inverted
  })

  it('computes dashboard KPI metrics and attention flags', () => {
    const mockState = {
      workouts: [
        {
          d: '2026-10-10',
          entries: [{ id: 'bench-press', sets: [{ w: 80, r: 10, done: true }] }]
        },
        {
          d: '2026-10-25',
          entries: [{ id: 'bench-press', sets: [{ w: 80, r: 10, done: true }] }]
        }
      ],
      bodyweight: [
        { d: '2026-09-20', w: 80 },
        { d: '2026-10-25', w: 79.2 }
      ],
      targetW: 76,
      unit: 'kg',
      week: { 1: 'r1', 3: 'r2', 5: 'r3' }
    }

    const kpis = computeDashboardKPIs(mockState, 30)
    expect(kpis.workouts.count).toBeGreaterThanOrEqual(1)
    expect(kpis.bodyweight.current).toBe(79.2)
    expect(kpis.bodyweight.delta30d).toBe(-0.8)
    expect(kpis.bodyweight.target).toBe(76)

    const attention = computeDashboardAttention(mockState)
    expect(Array.isArray(attention)).toBe(true)
  })
})
