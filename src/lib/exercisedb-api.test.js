import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeExerciseDB,
  FEATURED_EXERCISEDB_EXERCISES,
  searchExerciseDB,
  getExerciseDBKey,
  isGymMachine
} from './exercisedb-api.js'
import { videoSrc, imgSrc, isExerciseDB, EXIDX } from './exercises.js'

describe('ExerciseDB API Engine & Media Adapter', () => {
  it('normalizes ExerciseDB V2 raw schema into OpenGym model with video', () => {
    const raw = {
      exerciseId: 'exr_sample123',
      name: 'Lever Pec Deck Fly',
      imageUrl: 'Lever-Pec-Deck-Fly-Chest.png',
      equipments: ['LEVERAGE MACHINE'],
      bodyParts: ['CHEST'],
      targetMuscles: ['Pectoralis Major Clavicular Head'],
      secondaryMuscles: ['Deltoid Anterior'],
      videoUrl: 'Lever-Pec-Deck-Fly-Chest.mp4',
      overview: 'Great chest fly exercise on a lever machine.',
      instructions: ['Sit on bench', 'Push handles forward'],
      exerciseTips: ['Keep elbows slightly bent', 'Breathe out on contraction'],
      variations: ['Cable Crossover', 'Dumbbell Fly']
    }

    const ex = normalizeExerciseDB(raw)
    expect(ex).toBeDefined()
    expect(ex.id).toBe('exr_sample123')
    expect(ex.n).toBe('Voador / Peck Deck na Máquina')
    expect(ex.bp).toBe('Peito')
    expect(ex.eq).toBe('Máquina de Alavanca')
    expect(ex.tg).toBe('Peitoral Superior')
    expect(ex.sm).toEqual(['Deltóide Anterior'])
    expect(ex.video).toBe('https://cdn.exercisedb.dev/videos/Lever-Pec-Deck-Fly-Chest.mp4')
    expect(ex.img).toBe('https://cdn.exercisedb.dev/media/images/Lever-Pec-Deck-Fly-Chest.png')
    expect(ex.overview).toBe('Great chest fly exercise on a lever machine.')
    expect(ex.tips).toHaveLength(2)
    expect(ex.variations).toContain('Cable Crossover')
    expect(ex.source).toBe('exercisedb')
    expect(isExerciseDB(ex)).toBe(true)

    // Checks that it registers in global EXIDX index
    expect(EXIDX['exr_sample123']).toBe(ex)
  })

  it('resolves video source correctly with videoSrc', () => {
    const exWithRelative = { video: 'test.mp4' }
    expect(videoSrc(exWithRelative)).toBe('https://cdn.exercisedb.dev/videos/test.mp4')

    const exWithAbsolute = { video: 'https://custom-cdn.com/videos/bench.mp4' }
    expect(videoSrc(exWithAbsolute)).toBe('https://custom-cdn.com/videos/bench.mp4')

    const exWithoutVideo = { img: 'still.jpg' }
    expect(videoSrc(exWithoutVideo)).toBe('')
  })

  it('resolves image source correctly with imgSrc for external URLs', () => {
    const exWithExternal = { img: 'https://cdn.exercisedb.dev/images/sample.webp' }
    expect(imgSrc(exWithExternal)).toBe('https://cdn.exercisedb.dev/images/sample.webp')

    const exWithLocal = { img: '0001-sample.jpg' }
    expect(imgSrc(exWithLocal)).toContain('0001-sample.jpg')
  })

  it('provides featured demo exercises out of the box with video demos', async () => {
    expect(FEATURED_EXERCISEDB_EXERCISES.length).toBeGreaterThan(0)
    const featured = FEATURED_EXERCISEDB_EXERCISES[0]
    expect(featured.video).toContain('.mp4')
    expect(featured.tips.length).toBeGreaterThan(0)
    expect(featured.overview).toBeDefined()

    // Test fallback search when no API key is configured
    const results = await searchExerciseDB('pec deck', {})
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].n).toContain('Pec Deck')
  })

  it('correctly identifies gym machine exercises with isGymMachine', () => {
    // Machines in gym
    expect(isGymMachine('leverage machine')).toBe(true)
    expect(isGymMachine('cable')).toBe(true)
    expect(isGymMachine('smith machine')).toBe(true)
    expect(isGymMachine('sled machine')).toBe(true)
    expect(isGymMachine('máquina de alavanca')).toBe(true)
    expect(isGymMachine('máquina smith')).toBe(true)
    expect(isGymMachine('cabo')).toBe(true)

    // Free weights and other equipment
    expect(isGymMachine('barbell')).toBe(false)
    expect(isGymMachine('dumbbell')).toBe(false)
    expect(isGymMachine('body weight')).toBe(false)
    expect(isGymMachine('band')).toBe(false)
    expect(isGymMachine('barra')).toBe(false)
    expect(isGymMachine('halteres')).toBe(false)
  })

  it('filters exercises by gym machines when equipment is "gym"', async () => {
    const gymResults = await searchExerciseDB('', { equipment: 'gym', limit: 60 })
    expect(gymResults.length).toBeGreaterThan(0)
    // Every exercise returned must be on a gym machine
    for (const ex of gymResults) {
      expect(isGymMachine(ex.eq)).toBe(true)
    }
  })
})
