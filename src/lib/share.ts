import {
  PHASE_TONES,
  WEEKDAYS,
  type CircuitBlock,
  type CircuitExercise,
  type PhaseTone,
  type RoundWeights,
  type Weekday,
  type Workout,
  type WorkoutBlock,
} from '../types/workout'
import { orderDays } from './days'
import { normalizeWeights } from './weights'
import { createId } from './workout'

/**
 * A workout as a URL fragment, readable and short enough to paste:
 *
 *   #v=1&n=Tuesday+arms&d=tu&b=warmup:25m:Run+%2F+stretch;circuit:3x45/15:Arms:Bicep+curls@15/20,Plank
 *
 * `v` is the format version, `n` the name, `d` the days, and `b` the
 * blocks separated by `;`. Fields within a block are separated by `:`.
 * A timed block is `kind:duration:name`. A circuit is
 * `circuit:ROUNDSxWORK/REST:name:exercises` (or `sets` for sets order),
 * with exercises separated by `,` and per-round weights after `@`,
 * separated by `/`. Trailing repeats of a weight are dropped, so
 * `@15/20` is 15, 20, 20. Names are percent-encoded with `+` for spaces.
 */
export const SHARE_VERSION = 1

const DAY_CODES: Record<Weekday, string> = {
  Monday: 'mo',
  Tuesday: 'tu',
  Wednesday: 'we',
  Thursday: 'th',
  Friday: 'fr',
  Saturday: 'sa',
  Sunday: 'su',
}

const TONE_KINDS: Record<PhaseTone, string> = {
  warmup: 'warmup',
  setup: 'setup',
  cleanup: 'cleanup',
  recovery: 'recovery',
  custom: 'timed',
}

function lookupKey<K extends string>(
  record: Record<K, string>,
  keys: readonly K[],
  value: string,
) {
  return keys.find((key) => record[key] === value)
}

function encodeName(name: string) {
  return encodeURIComponent(name.trim()).replace(/%20/g, '+')
}

function decodeName(text: string) {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return undefined
  }
}

function encodeDuration(seconds: number) {
  return seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}`
}

function decodeDuration(text: string) {
  const minutes = /^(\d{1,3})m(?:(\d{1,2})s?)?$/.exec(text)
  if (minutes) {
    return Number(minutes[1]) * 60 + Number(minutes[2] ?? 0)
  }
  const seconds = /^(\d{1,5})s?$/.exec(text)
  return seconds ? Number(seconds[1]) : undefined
}

function encodeWeights(weights: RoundWeights, rounds: number) {
  const sized = normalizeWeights(weights, rounds)
  while (sized.length > 1 && sized.at(-1) === sized.at(-2)) {
    sized.pop()
  }
  if (sized.every((weight) => weight === null)) {
    return ''
  }
  return `@${sized.map((weight) => (weight === null ? '' : String(weight))).join('/')}`
}

function decodeWeights(text: string, rounds: number): RoundWeights | undefined {
  const weights: RoundWeights = []
  for (const part of text.split('/')) {
    if (part === '') {
      weights.push(null)
    } else if (/^\d{1,4}(?:\.\d{1,2})?$/.test(part)) {
      weights.push(Number(part))
    } else {
      return undefined
    }
  }
  return normalizeWeights(weights, rounds)
}

function encodeExercise(exercise: CircuitExercise, rounds: number) {
  return encodeName(exercise.name) + encodeWeights(exercise.weights, rounds)
}

function decodeExercise(text: string, rounds: number): CircuitExercise | undefined {
  const at = text.indexOf('@')
  const name = decodeName(at === -1 ? text : text.slice(0, at))
  const weights =
    at === -1
      ? normalizeWeights([], rounds)
      : decodeWeights(text.slice(at + 1), rounds)
  if (name === undefined || !weights) {
    return undefined
  }
  return { id: createId('exercise'), name, weights }
}

function encodeBlock(block: WorkoutBlock) {
  if (block.type === 'phase') {
    return [
      TONE_KINDS[block.tone],
      encodeDuration(block.durationSeconds),
      encodeName(block.name),
    ].join(':')
  }
  const timing = `${block.rounds}x${encodeDuration(block.workSeconds)}/${encodeDuration(block.restSeconds)}`
  return [
    block.order === 'sets' ? 'sets' : 'circuit',
    timing,
    encodeName(block.name),
    block.exercises
      .map((exercise) => encodeExercise(exercise, block.rounds))
      .join(','),
  ].join(':')
}

function decodeCircuit(
  order: CircuitBlock['order'],
  fields: string[],
): CircuitBlock | undefined {
  const [timingText, nameText, exercisesText] = fields
  const timing = /^(\d{1,2})x([^/]+)\/(.+)$/.exec(timingText ?? '')
  const name = decodeName(nameText ?? '')
  if (!timing || name === undefined || exercisesText === undefined) {
    return undefined
  }
  const rounds = Number(timing[1])
  const workSeconds = decodeDuration(timing[2])
  const restSeconds = decodeDuration(timing[3])
  if (workSeconds === undefined || restSeconds === undefined) {
    return undefined
  }
  const exercises: CircuitExercise[] = []
  for (const part of exercisesText === '' ? [] : exercisesText.split(',')) {
    const exercise = decodeExercise(part, rounds)
    if (!exercise) {
      return undefined
    }
    exercises.push(exercise)
  }
  return {
    id: createId('circuit'),
    type: 'circuit',
    name,
    rounds,
    workSeconds,
    restSeconds,
    order,
    exercises,
  }
}

function decodeBlock(text: string): WorkoutBlock | undefined {
  const [kind, ...fields] = text.split(':')
  if (kind === 'circuit' || kind === 'sets') {
    return fields.length === 3 ? decodeCircuit(kind, fields) : undefined
  }
  const tone = lookupKey(TONE_KINDS, PHASE_TONES, kind)
  if (!tone || fields.length !== 2) {
    return undefined
  }
  const durationSeconds = decodeDuration(fields[0])
  const name = decodeName(fields[1])
  if (durationSeconds === undefined || name === undefined) {
    return undefined
  }
  return { id: createId('phase'), type: 'phase', name, durationSeconds, tone }
}

function decodeDays(text: string): Weekday[] | undefined {
  const days: Weekday[] = []
  for (const code of text === '' ? [] : text.split(',')) {
    const day = lookupKey(DAY_CODES, WEEKDAYS, code)
    if (!day) {
      return undefined
    }
    days.push(day)
  }
  return orderDays([...new Set(days)])
}

/** The fragment for a workout, without the leading `#`. */
export function encodeWorkoutHash(workout: Workout) {
  const params = [`v=${SHARE_VERSION}`, `n=${encodeName(workout.name)}`]
  const days = orderDays(workout.days)
  if (days.length > 0) {
    params.push(`d=${days.map((day) => DAY_CODES[day]).join(',')}`)
  }
  params.push(`b=${workout.blocks.map(encodeBlock).join(';')}`)
  return params.join('&')
}

/** A link that opens `workout` in the editor on the recipient's device. */
export function workoutLink(workout: Workout, base: string) {
  const url = new URL(base)
  url.search = ''
  url.hash = encodeWorkoutHash(workout)
  return url.toString()
}

/** Whether a fragment looks like a shared workout, valid or not. */
export function hasWorkoutHash(hash: string) {
  return /^#?v=\d/.test(hash)
}

/**
 * Reads a shared workout from a fragment, with or without the `#`.
 * Returns `undefined` when the fragment is malformed; a workout that
 * decodes but fails validation is returned for the editor to flag.
 */
export function decodeWorkoutHash(hash: string): Workout | undefined {
  const params = new Map<string, string>()
  for (const pair of hash.replace(/^#/, '').split('&')) {
    const at = pair.indexOf('=')
    if (at === -1) {
      return undefined
    }
    params.set(pair.slice(0, at), pair.slice(at + 1))
  }
  if (
    params.get('v') !== String(SHARE_VERSION) ||
    !params.has('n') ||
    !params.has('b')
  ) {
    return undefined
  }
  const name = decodeName(params.get('n') ?? '')
  const days = decodeDays(params.get('d') ?? '')
  if (name === undefined || !days) {
    return undefined
  }
  const blocks: WorkoutBlock[] = []
  const blocksText = params.get('b') ?? ''
  for (const part of blocksText === '' ? [] : blocksText.split(';')) {
    const block = decodeBlock(part)
    if (!block) {
      return undefined
    }
    blocks.push(block)
  }
  return { id: createId('workout'), name, days, blocks, createdAt: Date.now() }
}
