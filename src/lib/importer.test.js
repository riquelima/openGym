import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizePlan,
  fallbackHeuristicParse,
  resolveOrCreateExercise,
  applyImportedPlanToStore,
  pickRoutineEmoji,
  guessBodyPart,
  guessEquipment,
  DEFAULT_MINIMAX_KEY
} from './importer.js'
import { useStore, DEF } from '../store/useStore.js'

describe('importer.js', () => {
  beforeEach(() => {
    useStore.setState({ S: JSON.parse(JSON.stringify(DEF)) })
  })

  it('exposes the user Minimax default key', () => {
    expect(DEFAULT_MINIMAX_KEY).toBe('sk-cp-meaN0PHZdGi3-5gZffia9b6PyDIh27vyk54LwG6gw965dFLWoIHowFo19rTqoHdbxhaQezJlMMBgTEYhNni51sJnMWCcPHIKtCg4GRY-pGMmrXarNIxxGQA')
  })

  it('normalizes plans with routines or days gracefully', () => {
    const rawWithDays = {
      name: 'Ficha ABC',
      days: [
        {
          name: 'Dia 1 - Peito',
          exercises: [
            { name: 'Supino reto', sets: 4, reps: '8-12', weight: 60 }
          ]
        }
      ]
    }
    const normalized = normalizePlan(rawWithDays)
    expect(normalized.name).toBe('Ficha ABC')
    expect(normalized.routines.length).toBe(1)
    expect(normalized.routines[0].name).toBe('Dia 1 - Peito')
    expect(normalized.routines[0].exercises[0].sets).toBe(4)
    expect(normalized.routines[0].exercises[0].weight).toBe(60)
  })

  it('falls back to offline heuristic parser when text is provided', () => {
    const text = `
    TREINO A - PEITO E TRÍCEPS
    1. Supino reto com barra 4x 10 30kg
    2. Crucifixo com halteres 3x12 14kg
    TREINO B - COSTAS
    1. Puxada frontal 4x10 50kg
    `
    const parsed = fallbackHeuristicParse(text)
    expect(parsed.routines.length).toBe(2)
    expect(parsed.routines[0].exercises.length).toBe(2)
    expect(parsed.routines[0].exercises[0].name).toContain('Supino reto')
    expect(parsed.routines[0].exercises[0].sets).toBe(4)
  })

  it('resolves standard gym exercises to library IDs and creates custom for unlisted', () => {
    const s = useStore.getState().S
    const supinoId = resolveOrCreateExercise(s, 'Supino reto com barra')
    expect(supinoId).toBe('0025')

    const customId = resolveOrCreateExercise(s, 'Elevação no Elástico Espacial')
    expect(customId.startsWith('c_')).toBe(true)
    expect(s.customEx.some(c => c.id === customId)).toBe(true)
  })

  it('automatically applies imported plan to store and assigns weekly schedule', () => {
    const plan = {
      name: 'Hipertrofia ABC',
      routines: [
        {
          name: 'Treino A — Peito',
          emoji: 'barbell',
          exercises: [{ name: 'Supino reto', sets: 4, reps: '10', weight: 50 }]
        },
        {
          name: 'Treino B — Costas',
          emoji: 'pullup',
          exercises: [{ name: 'Puxada frontal', sets: 4, reps: '10', weight: 45 }]
        },
        {
          name: 'Treino C — Pernas',
          emoji: 'legs',
          exercises: [{ name: 'Agachamento livre', sets: 4, reps: '10', weight: 60 }]
        }
      ]
    }

    const res = applyImportedPlanToStore(plan, { schedule: true })
    expect(res.count).toBe(3)
    
    const state = useStore.getState().S
    expect(state.routines.length).toBe(3)
    expect(state.routines[0].name).toBe('Treino A — Peito')
    expect(state.routines[0].ex.length).toBe(1)
    expect(state.week[1]).toBe(state.routines[0].id) // Mon
    expect(state.week[3]).toBe(state.routines[1].id) // Wed
    expect(state.week[5]).toBe(state.routines[2].id) // Fri
  })
})
