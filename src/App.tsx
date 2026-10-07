import { useEffect, useState } from 'react'
import './App.css'
import {
  HomeScreen,
  type NewWorkoutOptions,
} from './components/HomeScreen'
import { TimerScreen } from './components/TimerScreen'
import { WorkoutEditor } from './components/WorkoutEditor'
import { createSeedWorkouts, createStandardBlocks } from './data/seed'
import { cuePlayer } from './lib/cues'
import { decodeWorkoutHash, hasWorkoutHash } from './lib/share'
import {
  createIndexedDbStore,
  type SignalStore,
  type StoredData,
} from './lib/storage'
import {
  calculateWorkoutDuration,
  cloneWorkout,
  createId,
} from './lib/workout'
import type { Workout, WorkoutRun } from './types/workout'

type Route =
  | { screen: 'home' }
  | { screen: 'editor'; workout: Workout; isNew: boolean }
  | { screen: 'timer'; workout: Workout; runId: string }

const defaultStore = createIndexedDbStore()

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function upsert<T extends { id: string }>(items: T[], item: T) {
  return items.some((candidate) => candidate.id === item.id)
    ? items.map((candidate) => (candidate.id === item.id ? item : candidate))
    : [...items, item]
}

function buildWorkout(options: NewWorkoutOptions, workouts: Workout[]): Workout {
  const { source } = options
  const copied =
    source.kind === 'copy'
      ? workouts.find((workout) => workout.id === source.workoutId)
      : undefined
  if (copied) {
    return cloneWorkout(copied, { name: options.name, days: options.days })
  }
  return {
    id: createId('workout'),
    name: options.name,
    days: options.days,
    createdAt: Date.now(),
    blocks: source.kind === 'blank' ? [] : createStandardBlocks(),
  }
}

export default function App({ store = defaultStore }: { store?: SignalStore }) {
  const [data, setData] = useState<StoredData | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [route, setRoute] = useState<Route>({ screen: 'home' })

  useEffect(() => {
    let cancelled = false
    store
      .load()
      .then((loaded) => {
        if (!cancelled) {
          setData(loaded)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setData({ workouts: createSeedWorkouts(), runs: [] })
          setNotice(
            `Workouts can't be saved on this device: ${errorMessage(error)}`,
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [store])

  // A shared link opens its workout in the editor, unsaved. The fragment
  // is cleared right away so a reload does not import it again.
  useEffect(() => {
    const consumeLink = () => {
      const { hash, pathname, search } = window.location
      if (!hasWorkoutHash(hash)) {
        return
      }
      window.history.replaceState(null, '', pathname + search)
      const workout = decodeWorkoutHash(hash)
      if (workout) {
        setRoute({ screen: 'editor', workout, isNew: true })
      } else {
        setRoute({ screen: 'home' })
        setNotice("This link doesn't contain a valid workout.")
      }
    }
    consumeLink()
    window.addEventListener('hashchange', consumeLink)
    return () => window.removeEventListener('hashchange', consumeLink)
  }, [])

  const persist = (operation: Promise<void>) => {
    operation.catch((error: unknown) =>
      setNotice(`Couldn't save to this laptop: ${errorMessage(error)}`),
    )
  }

  if (!data) {
    return <main className="home" aria-busy="true" />
  }

  const saveWorkout = (workout: Workout) => {
    setData((current) => current && { ...current, workouts: upsert(current.workouts, workout) })
    persist(store.saveWorkout(workout))
  }

  // Runs from a click, which is what lets the browser play sound.
  const startWorkout = (workout: Workout) => {
    void cuePlayer.unlock().catch(() => {})
    const now = Date.now()
    const run: WorkoutRun = {
      id: createId('run'),
      workoutId: workout.id,
      workoutName: workout.name,
      startedAt: now,
      updatedAt: now,
      elapsedSeconds: 0,
      totalSeconds: calculateWorkoutDuration(workout),
      completed: false,
    }
    setData((current) => current && { ...current, runs: [...current.runs, run] })
    persist(store.saveRun(run))
    setRoute({ screen: 'timer', workout, runId: run.id })
  }

  const recordProgress = (runId: string, elapsedSeconds: number, completed: boolean) => {
    const run = data.runs.find((candidate) => candidate.id === runId)
    if (
      !run ||
      (run.completed && !completed) ||
      (run.completed === completed && run.elapsedSeconds === elapsedSeconds)
    ) {
      return
    }
    const updated: WorkoutRun = {
      ...run,
      elapsedSeconds: completed ? run.totalSeconds : elapsedSeconds,
      completed,
      updatedAt: Date.now(),
    }
    setData((current) => current && { ...current, runs: upsert(current.runs, updated) })
    persist(store.saveRun(updated))
  }

  const deleteWorkout = (workout: Workout) => {
    setData(
      (current) =>
        current && {
          workouts: current.workouts.filter((candidate) => candidate.id !== workout.id),
          runs: current.runs.filter((run) => run.workoutId !== workout.id),
        },
    )
    persist(store.deleteWorkout(workout.id))
  }

  const goHome = () => setRoute({ screen: 'home' })

  if (route.screen === 'timer') {
    return (
      <TimerScreen
        key={route.runId}
        workout={route.workout}
        onProgress={(elapsedSeconds, completed) =>
          recordProgress(route.runId, elapsedSeconds, completed)
        }
        onExit={goHome}
        onRestart={() => startWorkout(route.workout)}
      />
    )
  }

  if (route.screen === 'editor') {
    return (
      <WorkoutEditor
        key={route.workout.id}
        workout={route.workout}
        isNew={route.isNew}
        onSave={(workout) => {
          saveWorkout(workout)
          goHome()
        }}
        onStart={(workout) => {
          saveWorkout(workout)
          startWorkout(workout)
        }}
        onDelete={(workout) => {
          deleteWorkout(workout)
          goHome()
        }}
        onClose={goHome}
      />
    )
  }

  return (
    <HomeScreen
      workouts={data.workouts}
      runs={data.runs}
      notice={notice}
      onStart={startWorkout}
      onEdit={(workout) => setRoute({ screen: 'editor', workout, isNew: false })}
      onCreate={(options) =>
        setRoute({
          screen: 'editor',
          workout: buildWorkout(options, data.workouts),
          isNew: true,
        })
      }
    />
  )
}
