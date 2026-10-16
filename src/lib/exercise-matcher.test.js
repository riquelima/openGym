import { describe, it, expect } from 'vitest'
import {
  matchCatalogExercise,
  resolveOrCreateExercise,
  healCustomExercises,
  resolvePlanExercisesAsync,
  GYM_ALIASES,
  BODYPART_ARCHETYPES
} from './exercise-matcher.js'
import { EXIDX } from './exercises.js'

describe('exercise-matcher.js', () => {
  it('matches all exercises from the user workout with verified photos and videos', () => {
    const testCases = [
      { input: 'Supino Inclinado Com Barra', expectedId: '0047' },
      { input: 'Supino Com Barra', expectedId: '0025' },
      { input: 'Voador (Peck Deck)', expectedId: 'exdb_pec_deck' },
      { input: 'Cross Over', expectedId: 'exdb_cable_crossover' },
      { input: 'Levantamento Frontal Com Barra', expectedId: '0041' },
      { input: 'Elevação Lateral Com Halteres', expectedId: '0334' },
      { input: 'Levantamento Frontal Da Banda', expectedId: '0978' }
    ]

    for (const tc of testCases) {
      const match = matchCatalogExercise(tc.input)
      expect(match).not.toBeNull()
      expect(match.id).toBe(tc.expectedId)
      // Verify exercise has media (image, gif, or video)
      expect(match.img || match.gif || match.video).toBeDefined()
    }
  })

  it('matches classic Brazilian gym nicknames', () => {
    expect(matchCatalogExercise('Voador')?.id).toBe('exdb_pec_deck')
    expect(matchCatalogExercise('Peck Deck')?.id).toBe('exdb_pec_deck')
    expect(matchCatalogExercise('Crossover no Cabo')?.id).toBe('exdb_cable_crossover')
    expect(matchCatalogExercise('Cadeira Extensora')?.id).toBe('0585')
    expect(matchCatalogExercise('Mesa Flexora')?.id).toBe('0586')
    expect(matchCatalogExercise('Tríceps Corda')?.id).toBe('0194')
  })

  it('guarantees media and video on any custom created exercise', () => {
    const s = { customEx: [] }
    const customId = resolveOrCreateExercise(s, 'Exercício Hipotético Espacial 3000')
    expect(customId.startsWith('c_')).toBe(true)
    const created = s.customEx.find(c => c.id === customId)
    expect(created).toBeDefined()
    expect(created.img).toBeDefined()
    expect(created.gif).toBeDefined()
    expect(created.video).toBeDefined()
    expect(created.st.length).toBeGreaterThan(0)
  })

  it('heals existing imported routines that had custom exercises without media', () => {
    const mockState = {
      customEx: [
        { id: 'c_voador_old', n: 'Voador (Peck Deck)' },
        { id: 'c_crossover_old', n: 'Cross Over' }
      ],
      routines: [
        {
          id: 'r_abc',
          name: 'Treino A — Peito e Ombro',
          ex: [
            { id: '0047' },
            { id: '0025' },
            { id: 'c_voador_old' },
            { id: 'c_crossover_old' },
            { id: '0041' }
          ]
        }
      ]
    }

    const modified = healCustomExercises(mockState)
    expect(modified).toBe(true)
    // Verify routine now points to canonical IDs with full videos and images
    expect(mockState.routines[0].ex[2].id).toBe('exdb_pec_deck')
    expect(mockState.routines[0].ex[3].id).toBe('exdb_cable_crossover')
  })

  it('resolves plan exercises asynchronously before creating routines', async () => {
    const plan = {
      routines: [
        {
          name: 'Treino A',
          exercises: [
            { name: 'Voador (Peck Deck)' },
            { name: 'Cross Over' }
          ]
        }
      ]
    }

    await resolvePlanExercisesAsync(plan)
    expect(plan.routines[0].exercises[0].id).toBe('exdb_pec_deck')
    expect(plan.routines[0].exercises[1].id).toBe('exdb_cable_crossover')
  })
})
