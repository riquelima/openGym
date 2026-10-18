import { describe, it, expect } from 'vitest'
import { EXDB, allExercises, isGymEquipment, isGymMachine } from './exercises.js'
import './exercisedb-api.js'
import { musclesOf, MUSCLES, MUSCLE_NAME, loadOfWorkouts, levelsOf, rankOf } from './muscles.js'

describe('Interactive Skeleton & Body Explorer Logic', () => {
  it('maps all 18 anatomical muscles to exercises in the catalogue', () => {
    const fakeStore = { customEx: [] }
    const all = allExercises(fakeStore)
    expect(all.length).toBeGreaterThan(1000)

    const muscleCounts = {}
    MUSCLES.forEach(slug => { muscleCounts[slug] = 0 })

    all.forEach(ex => {
      const m = musclesOf(ex)
      for (const slug in m) {
        if (muscleCounts[slug] !== undefined && m[slug] > 0) {
          muscleCounts[slug]++
        }
      }
    })

    // Every muscle group should have matching exercises
    MUSCLES.forEach(slug => {
      expect(muscleCounts[slug]).toBeGreaterThan(0)
    })

    expect(muscleCounts['chest']).toBeGreaterThan(300)
    expect(muscleCounts['deltoids']).toBeGreaterThan(500)
    expect(muscleCounts['quadriceps']).toBeGreaterThan(400)
    expect(muscleCounts['biceps']).toBeGreaterThan(400)
    expect(muscleCounts['upper-back']).toBeGreaterThan(400)
  })

  it('correctly maps Portuguese anatomical terms to muscle slugs', () => {
    const ptExercise1 = {
      id: 'pt_1',
      n: 'Supino Reto com Barra',
      bp: 'peito',
      tg: 'peitorais',
      sm: ['deltóide anterior', 'tríceps']
    }
    const m1 = musclesOf(ptExercise1)
    expect(m1['chest']).toBe(1)
    expect(m1['deltoids']).toBe(0.4)
    expect(m1['triceps']).toBe(0.4)

    const ptExercise2 = {
      id: 'pt_2',
      n: 'Puxada Alta',
      bp: 'costas',
      tg: 'dorsais',
      sm: ['bíceps', 'rombóides']
    }
    const m2 = musclesOf(ptExercise2)
    expect(m2['upper-back']).toBe(1)
    expect(m2['biceps']).toBe(0.4)

    const ptExercise3 = {
      id: 'pt_3',
      n: 'Leg Press 45',
      bp: 'pernas',
      tg: 'quadríceps',
      sm: ['glúteos']
    }
    const m3 = musclesOf(ptExercise3)
    expect(m3['quadriceps']).toBe(1)
    expect(m3['gluteal']).toBe(0.4)
  })

  it('filters exercises by equipment, role, and text search', () => {
    const chestExercises = EXDB.filter(e => {
      const m = musclesOf(e)
      return m['chest'] && m['chest'] > 0
    })
    expect(chestExercises.length).toBeGreaterThan(100)

    // Filter by text search
    const benchPresses = chestExercises.filter(e =>
      (e.n && e.n.toLowerCase().includes('supino')) ||
      (e.rawName && e.rawName.toLowerCase().includes('press')) ||
      (e.n && e.n.toLowerCase().includes('press'))
    )
    expect(benchPresses.length).toBeGreaterThan(5)

    // Filter by Gym Equipment
    const gymOnly = chestExercises.filter(e => isGymEquipment(e.eq, e))
    expect(gymOnly.length).toBeGreaterThan(0)
    expect(gymOnly.length).toBeLessThanOrEqual(chestExercises.length)

    // Primary target vs secondary helper
    const primaryChest = chestExercises.filter(e => musclesOf(e)['chest'] >= 0.75)
    const secondaryChest = chestExercises.filter(e => musclesOf(e)['chest'] < 0.75)
    expect(primaryChest.length).toBeGreaterThan(0)
    expect(secondaryChest.length).toBeGreaterThan(0)
    expect(primaryChest.length + secondaryChest.length).toBe(chestExercises.length)
  })

  it('computes workout load, levels, and ranked muscles for skeleton shading', () => {
    const mockWorkouts = [
      {
        id: 'w1',
        d: '2026-10-18',
        entries: [
          {
            id: 'exdb_bench_press',
            sets: [
              { done: true, w: 80, r: 10 },
              { done: true, w: 85, r: 8 },
              { done: true, w: 90, r: 6 }
            ]
          }
        ]
      }
    ]

    const load = loadOfWorkouts(mockWorkouts)
    expect(load['chest']).toBe(3) // 3 sets * 1.0 weight
    expect(load['deltoids']).toBeCloseTo(1.2) // 3 sets * 0.4 weight
    expect(load['triceps']).toBeCloseTo(1.2) // 3 sets * 0.4 weight

    const levels = levelsOf(load)
    expect(levels['chest']).toBe(4) // Max muscle gets level 4
    expect(levels['deltoids']).toBeGreaterThanOrEqual(1)

    const { worked, missed } = rankOf(load)
    expect(worked).toContain('chest')
    expect(worked[0]).toBe('chest')
    expect(missed).toContain('quadriceps')
  })
})
