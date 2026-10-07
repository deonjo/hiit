import { describe, expect, it } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import type { Workout } from '../types/workout'
import {
  decodeWorkoutHash,
  encodeWorkoutHash,
  hasWorkoutHash,
  workoutLink,
} from './share'
import { validateWorkout } from './workout'

function withoutIds(workout: Workout) {
  return {
    name: workout.name,
    days: workout.days,
    blocks: workout.blocks.map((block) => {
      const { id: _id, ...rest } = block
      return rest.type === 'circuit'
        ? {
            ...rest,
            exercises: rest.exercises.map(({ id: _exerciseId, ...exercise }) => exercise),
          }
        : rest
    }),
  }
}

describe('share links', () => {
  it('encodes the seed workout as a readable fragment', () => {
    const [tuesday] = createSeedWorkouts(0)
    expect(encodeWorkoutHash(tuesday)).toBe(
      'v=1&n=Tuesday+arms&d=tu&b=' +
        'warmup:25m:Run+%2F+stretch;' +
        'setup:5m:Set+up+equipment;' +
        'circuit:3x45/15:Arms+and+core:' +
        'Bicep+curls@15/20,Plank,Tricep+extension@5,Plank;' +
        'cleanup:5m:Put+equipment+away',
    )
  })

  it('round-trips every seed workout', () => {
    for (const workout of createSeedWorkouts(0)) {
      const decoded = decodeWorkoutHash(`#${encodeWorkoutHash(workout)}`)
      expect(decoded).toBeDefined()
      expect(withoutIds(decoded!)).toEqual(withoutIds(workout))
      expect(decoded!.id).not.toBe(workout.id)
      expect(validateWorkout(decoded!)).toEqual([])
    }
  })

  it('round-trips odd durations, weights, days, and names', () => {
    const workout: Workout = {
      id: 'w',
      name: 'Legs & core: "heavy" day #2, 50% effort',
      days: ['Sunday', 'Monday'],
      createdAt: 0,
      blocks: [
        { id: 'p', type: 'phase', name: 'Walk+jog', durationSeconds: 90, tone: 'custom' },
        {
          id: 'c',
          type: 'circuit',
          name: 'Sets; one at a time',
          rounds: 4,
          workSeconds: 60,
          restSeconds: 20,
          order: 'sets',
          exercises: [
            { id: 'a', name: 'Goblet squat', weights: [12.5, null, 20, 20] },
            { id: 'b', name: 'Lunges', weights: [10, null, null, null] },
            { id: 'c', name: 'Plank', weights: [null, null, null, null] },
          ],
        },
      ],
    }
    const hash = encodeWorkoutHash(workout)
    expect(hash).toContain('d=mo,su')
    expect(hash).toContain('timed:90:Walk%2Bjog')
    expect(hash).toContain('sets:4x1m/20:')
    expect(hash).toContain('Goblet+squat@12.5//20,Lunges@10/,Plank')
    expect(withoutIds(decodeWorkoutHash(hash)!)).toEqual({
      ...withoutIds(workout),
      days: ['Monday', 'Sunday'],
    })
  })

  it('fills missing weights to the round count', () => {
    const decoded = decodeWorkoutHash('v=1&n=x&b=circuit:3x45/15:c:Curls@15')
    const circuit = decoded?.blocks[0]
    expect(circuit?.type === 'circuit' && circuit.exercises[0].weights).toEqual([
      15, 15, 15,
    ])
  })

  it('accepts minute and second spellings', () => {
    const decoded = decodeWorkoutHash(
      'v=1&n=x&b=warmup:1m30:a;setup:1m30s:b;cleanup:45s:c;timed:2m:d',
    )
    expect(decoded?.blocks.map((block) => block.type === 'phase' && block.durationSeconds)).toEqual([
      90, 90, 45, 120,
    ])
  })

  it('returns an invalid workout for the editor to flag', () => {
    const decoded = decodeWorkoutHash('v=1&n=&b=')
    expect(decoded).toMatchObject({ name: '', blocks: [] })
    expect(validateWorkout(decoded!).length).toBeGreaterThan(0)
  })

  it.each([
    ['', 'empty'],
    ['v=2&n=x&b=', 'unknown version'],
    ['n=x&b=', 'missing version'],
    ['v=1&b=', 'missing name'],
    ['v=1&n=x', 'missing blocks'],
    ['v=1&n=x&d=xx&b=', 'unknown day'],
    ['v=1&n=x&b=sprint:5m:a', 'unknown block kind'],
    ['v=1&n=x&b=warmup:5m', 'missing block name'],
    ['v=1&n=x&b=warmup:five:a', 'bad duration'],
    ['v=1&n=x&b=circuit:3x45:a:b', 'missing rest'],
    ['v=1&n=x&b=circuit:3x45/15:a:b@heavy', 'bad weight'],
    ['v=1&n=%E0%A4%A&b=', 'bad percent escape'],
    ['v=1&n=x&junk', 'pair without a value'],
  ])('rejects %s (%s)', (hash) => {
    expect(decodeWorkoutHash(hash)).toBeUndefined()
  })

  it('builds a link from the page origin and path only', () => {
    const [tuesday] = createSeedWorkouts(0)
    const link = workoutLink(tuesday, 'https://hiit.example/app/?utm=1#old')
    expect(link.startsWith('https://hiit.example/app/#v=1&n=Tuesday+arms')).toBe(true)
    expect(hasWorkoutHash(new URL(link).hash)).toBe(true)
    expect(hasWorkoutHash('#settings')).toBe(false)
    expect(hasWorkoutHash('')).toBe(false)
  })
})
