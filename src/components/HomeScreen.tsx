import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useWindowChrome } from '../hooks/useWindowChrome'
import { STANDARD_TEMPLATE } from '../data/seed'
import { orderDays, SHORT_DAYS } from '../lib/days'
import { formatLongDate, formatMinutes } from '../lib/format'
import { describeRun, groupWorkoutsForHome, scheduleLabel } from '../lib/history'
import { calculateWorkoutDuration, validateWorkout } from '../lib/workout'
import type { Weekday, Workout, WorkoutRun } from '../types/workout'
import { DayPicker } from './DayPicker'
import { CloseIcon, EditIcon, PlayIcon, PlusIcon } from './Icons'
import { ShareButton } from './ShareButton'
import { WorkoutStrip } from './WorkoutStrip'

export type NewWorkoutSource =
  | { kind: 'standard' }
  | { kind: 'copy'; workoutId: string }
  | { kind: 'blank' }

export interface NewWorkoutOptions {
  name: string
  days: Weekday[]
  source: NewWorkoutSource
}

interface HomeScreenProps {
  workouts: Workout[]
  runs: WorkoutRun[]
  notice: string | null
  onStart: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onCreate: (options: NewWorkoutOptions) => void
}

function exerciseSummary(workout: Workout) {
  const exercises = workout.blocks.flatMap((block) =>
    block.type === 'circuit' ? block.exercises.map((exercise) => exercise.name) : [],
  )
  const names =
    exercises.length > 0 ? exercises : workout.blocks.map((block) => block.name)
  return names.join(' · ')
}

interface WorkoutCardProps {
  workout: Workout
  run?: WorkoutRun
  now: number
  onStart: () => void
  onEdit: () => void
}

function WorkoutCard({ workout, run, now, onStart, onEdit }: WorkoutCardProps) {
  const runnable = validateWorkout(workout).length === 0
  return (
    <article className="workout-card">
      <div className="workout-card-top">
        <div className="workout-card-text">
          <div className="workout-card-title">
            <h3>{workout.name}</h3>
            {orderDays(workout.days).map((day) => (
              <span className="chip" key={day}>
                {SHORT_DAYS[day]}
              </span>
            ))}
          </div>
          <p className="meta">
            {run
              ? describeRun(run, now)
              : formatMinutes(calculateWorkoutDuration(workout))}
          </p>
        </div>
        <div className="workout-card-actions">
          <ShareButton workout={workout} variant="icon" disabled={!runnable} />
          <button
            className="icon-button"
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${workout.name}`}
          >
            <EditIcon />
          </button>
          <button
            className="button button-dark"
            type="button"
            onClick={onStart}
            disabled={!runnable}
            aria-label={`Start ${workout.name}`}
          >
            <PlayIcon />
            Start
          </button>
        </div>
      </div>
      <WorkoutStrip workout={workout} />
      <p className="workout-card-exercises">{exerciseSummary(workout)}</p>
    </article>
  )
}

interface NewWorkoutDialogProps {
  workouts: Workout[]
  onClose: () => void
  onCreate: (options: NewWorkoutOptions) => void
}

function NewWorkoutDialog({ workouts, onClose, onCreate }: NewWorkoutDialogProps) {
  const titleId = useId()
  const nameId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [nameMissing, setNameMissing] = useState(false)
  const [days, setDays] = useState<Weekday[]>([])
  const [source, setSource] = useState<NewWorkoutSource['kind']>('standard')
  const [copyId, setCopyId] = useState(workouts[0]?.id ?? '')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setNameMissing(true)
      nameRef.current?.focus()
      return
    }
    onCreate({
      name: name.trim(),
      days,
      source:
        source === 'copy' && copyId
          ? { kind: 'copy', workoutId: copyId }
          : source === 'blank'
            ? { kind: 'blank' }
            : { kind: 'standard' },
    })
  }

  return (
    <div className="dialog-backdrop">
      <form
        className="dialog new-workout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
      >
        <div className="dialog-heading">
          <h2 className="dialog-title" id={titleId}>
            New workout
          </h2>
          <button
            className="icon-only"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <label className="field-label" htmlFor={nameId}>
          Name
        </label>
        <input
          className="text-input"
          id={nameId}
          ref={nameRef}
          value={name}
          maxLength={80}
          placeholder="Thursday legs"
          autoFocus
          aria-invalid={nameMissing || undefined}
          aria-describedby={nameMissing ? `${nameId}-error` : undefined}
          onChange={(event) => {
            setName(event.target.value)
            setNameMissing(false)
          }}
        />
        {nameMissing && (
          <p className="field-error" id={`${nameId}-error`}>
            Give the workout a name.
          </p>
        )}

        <p className="field-label">Repeat on</p>
        <DayPicker days={days} onChange={setDays} />

        <fieldset className="source-options">
          <legend className="field-label">Start from</legend>
          <label className="source-option" data-selected={source === 'standard'}>
            <input
              type="radio"
              name="source"
              checked={source === 'standard'}
              onChange={() => setSource('standard')}
            />
            <span className="source-text">
              <strong>Standard template</strong>
              <span className="meta">
                Warm-up 25 · setup 5 · circuit 3 × 4 · cleanup 5
              </span>
              <WorkoutStrip workout={STANDARD_TEMPLATE} className="is-small" />
            </span>
          </label>
          <label className="source-option" data-selected={source === 'copy'}>
            <input
              type="radio"
              name="source"
              checked={source === 'copy'}
              disabled={workouts.length === 0}
              onChange={() => setSource('copy')}
            />
            <span className="source-text">
              <strong>Copy an existing workout</strong>
              <select
                className="chip-select"
                value={copyId}
                disabled={workouts.length === 0}
                aria-label="Workout to copy"
                onChange={(event) => {
                  setCopyId(event.target.value)
                  setSource('copy')
                }}
              >
                {workouts.map((workout) => (
                  <option value={workout.id} key={workout.id}>
                    {workout.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="source-option" data-selected={source === 'blank'}>
            <input
              type="radio"
              name="source"
              checked={source === 'blank'}
              onChange={() => setSource('blank')}
            />
            <span className="source-text">
              <strong>Blank</strong>
              <span className="meta">Add blocks yourself</span>
            </span>
          </label>
        </fieldset>

        <div className="dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-heat" type="submit">
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

export function HomeScreen({
  workouts,
  runs,
  notice,
  onStart,
  onEdit,
  onCreate,
}: HomeScreenProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const { recent, notRun } = useMemo(
    () => groupWorkoutsForHome(workouts, runs),
    [runs, workouts],
  )
  const schedule = scheduleLabel(workouts, now)
  const ordered = [...recent.map((entry) => entry.workout), ...notRun]

  useWindowChrome('HIIT')

  return (
    <main className="home">
      <header className="home-header">
        <div>
          <p className="meta">
            {formatLongDate(now)}
            {schedule && ` · ${schedule}`}
          </p>
          <h1 className="page-title">Your workouts</h1>
        </div>
        <button
          className="button button-heat button-create"
          type="button"
          onClick={() => setDialogOpen(true)}
        >
          <PlusIcon />
          Create new workout
        </button>
      </header>

      {notice && (
        <p className="home-notice" role="alert">
          {notice}
        </p>
      )}

      {recent.length > 0 && (
        <section className="workout-list" aria-labelledby="recently-run">
          <h2 className="section-label" id="recently-run">
            Recently run
          </h2>
          {recent.map(({ workout, run }) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              run={run}
              now={now}
              onStart={() => onStart(workout)}
              onEdit={() => onEdit(workout)}
            />
          ))}
        </section>
      )}

      {notRun.length > 0 && (
        <section className="workout-list" aria-labelledby="not-run-yet">
          <h2 className="section-label" id="not-run-yet">
            Not run yet
          </h2>
          {notRun.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              now={now}
              onStart={() => onStart(workout)}
              onEdit={() => onEdit(workout)}
            />
          ))}
        </section>
      )}

      {workouts.length === 0 && (
        <p className="home-empty">
          No workouts yet. Create one to get started.
        </p>
      )}

      <footer className="phase-legend" aria-label="Phase colors">
        <span><i className="swatch" data-tone="warmup" />Warm-up</span>
        <span><i className="swatch" data-tone="setup" />Setup and cleanup</span>
        <span><i className="swatch" data-tone="work" />Work</span>
        <span><i className="swatch" data-tone="rest" />Rest</span>
      </footer>

      {dialogOpen && (
        <NewWorkoutDialog
          workouts={ordered}
          onClose={() => setDialogOpen(false)}
          onCreate={onCreate}
        />
      )}
    </main>
  )
}
