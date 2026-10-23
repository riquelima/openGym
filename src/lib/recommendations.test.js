import { describe, it, expect } from 'vitest'
import {
  generateAICoachCards,
  analyzeBiometrics,
  analyzeWorkoutsHistory,
  analyzeProgressionAndStalls,
  analyzeMuscleSymmetry
} from './recommendations.js'
import faIcons from '../components/fa-icons.json'

describe('recommendations engine', () => {
  const emptyState = {
    workouts: [],
    bodyweight: [],
    targetW: null,
    unit: 'kg',
    week: {},
    routines: [],
    active: null,
    restSec: 90
  }

  it('guarantees at least 10 cards even on empty state', () => {
    const cards = generateAICoachCards(emptyState, { today: '2026-10-23' })
    expect(cards.length).toBeGreaterThanOrEqual(10)
    cards.forEach(c => {
      expect(c.id).toBeTruthy()
      expect(c.title).toBeTruthy()
      expect(c.summary).toBeTruthy()
      expect(c.detail).toBeTruthy()
      expect(c.category).toBeTruthy()
      expect(c.badge).toBeTruthy()
      expect(c.icon).toBeTruthy()
      // Icon must exist in fa-icons or local icons
      expect(faIcons[c.icon] || c.icon === 'grip').toBeTruthy()
    })
  })

  it('calculates personalized nutrition and hydration based on body weight', () => {
    const stateWithBW = {
      ...emptyState,
      bodyweight: [{ d: '2026-10-23', w: 80, t: Date.now() }],
      targetW: 75
    }
    const bio = analyzeBiometrics(stateWithBW)
    expect(bio.curW).toBe(80)
    expect(bio.proteinMin).toBe(Math.round(80 * 1.6)) // 128
    expect(bio.proteinMax).toBe(Math.round(80 * 2.2)) // 176
    expect(bio.waterMinL).toBe(2.8) // 80 * 0.035
    expect(bio.goalType).toBe('cut')

    const cards = generateAICoachCards(stateWithBW, { today: '2026-10-23' })
    const proteinCard = cards.find(c => c.id === 'protein_target')
    expect(proteinCard).toBeDefined()
    expect(proteinCard.summary).toContain('128g a 176g')

    const hydrationCard = cards.find(c => c.id === 'hydration_target')
    expect(hydrationCard).toBeDefined()
    expect(hydrationCard.summary).toContain('2.8L')

    const cutCard = cards.find(c => c.id === 'nutrition_cutting_rate')
    expect(cutCard).toBeDefined()
  })

  it('rotates cards deterministically when the day changes', () => {
    const day1Cards = generateAICoachCards(emptyState, { today: '2026-10-23' })
    const day2Cards = generateAICoachCards(emptyState, { today: '2026-10-24' })

    expect(day1Cards.length).toBeGreaterThanOrEqual(10)
    expect(day2Cards.length).toBeGreaterThanOrEqual(10)

    // IDs order or content should differ due to daily seed PRNG
    const day1Ids = day1Cards.map(c => c.id).join(',')
    const day2Ids = day2Cards.map(c => c.id).join(',')
    expect(day1Ids).not.toBe(day2Ids)
  })

  it('detects active workout with top priority', () => {
    const activeState = {
      ...emptyState,
      active: {
        id: 'w-active',
        name: 'Treino A - Peito e Tríceps',
        entries: []
      }
    }
    const cards = generateAICoachCards(activeState, { today: '2026-10-23' })
    expect(cards[0].id).toBe('active_workout')
    expect(cards[0].title).toBe('Sessão em Andamento')
    expect(cards[0].action.path).toBe('/workout')
  })

  it('detects plateau / stall in an exercise', () => {
    const stalledState = {
      ...emptyState,
      workouts: [
        {
          d: '2026-10-15',
          entries: [{ id: 'bench-press', sets: [{ w: 80, r: 8, done: true }] }]
        },
        {
          d: '2026-10-19',
          entries: [{ id: 'bench-press', sets: [{ w: 80, r: 8, done: true }] }]
        }
      ]
    }
    const prog = analyzeProgressionAndStalls(stalledState)
    expect(prog.stalledExercise).toBeDefined()
    expect(prog.stalledExercise.weight).toBe(80)

    const cards = generateAICoachCards(stalledState, { today: '2026-10-23' })
    const stallCard = cards.find(c => c.id === 'stalled_breakthrough')
    expect(stallCard).toBeDefined()
    expect(stallCard.badge).toBe('Quebra de Platô')
  })

  it('detects quad vs posterior chain muscle imbalance', () => {
    const imbalancedState = {
      ...emptyState,
      dayPlan: {},
      workouts: [
        {
          d: '2026-10-20',
          entries: [
            // 1512 is a quads exercise in EXDB (target: quads)
            { id: '1512', sets: [{ w: 100, r: 10, done: true }, { w: 100, r: 10, done: true }, { w: 100, r: 10, done: true }, { w: 100, r: 10, done: true }, { w: 100, r: 10, done: true }, { w: 100, r: 10, done: true }, { w: 100, r: 10, done: true }, { w: 100, r: 10, done: true }] }
          ]
        }
      ]
    }
    const sym = analyzeMuscleSymmetry(imbalancedState)
    expect(sym.quadsLoad).toBeGreaterThan(6)
    expect(sym.hasQuadHamstringImbalance).toBe(true)

    const cards = generateAICoachCards(imbalancedState, { today: '2026-10-23' })
    const hamsCard = cards.find(c => c.id === 'imbalance_quads_hams')
    expect(hamsCard).toBeDefined()
  })

  it('handles state with multiple workouts, routines, and weights returning 10+ cards', () => {
    const fullState = {
      ...emptyState,
      dayPlan: {},
      targetW: 82,
      bodyweight: [
        { d: '2026-10-01', w: 85, t: 1 },
        { d: '2026-10-15', w: 84.2, t: 2 },
        { d: '2026-10-22', w: 83.5, t: 3 }
      ],
      routines: [
        { id: 'r1', name: 'Peito e Tríceps', ex: [{ id: '1254', sets: 4 }] }
      ],
      week: { 5: 'r1' }, // Friday
      workouts: [
        {
          d: '2026-10-18',
          start: new Date('2026-10-18T18:00:00').getTime(),
          end: new Date('2026-10-18T19:00:00').getTime(),
          entries: [{ id: '1254', sets: [{ w: 60, r: 10, done: true }] }]
        },
        {
          d: '2026-10-21',
          start: new Date('2026-10-21T18:30:00').getTime(),
          end: new Date('2026-10-21T19:35:00').getTime(),
          entries: [{ id: '1254', sets: [{ w: 62.5, r: 10, done: true }] }]
        }
      ]
    }

    const cards = generateAICoachCards(fullState, { today: '2026-10-23' })
    expect(cards.length).toBeGreaterThanOrEqual(10)
    expect(cards.length).toBeLessThanOrEqual(14)

    // Check diversity of categories
    const categories = new Set(cards.map(c => c.category))
    expect(categories.size).toBeGreaterThanOrEqual(4)

    // Check PR detection
    const prCard = cards.find(c => c.id === 'recent_pr_boost')
    expect(prCard).toBeDefined()
  })
})
