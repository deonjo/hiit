import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { createMemoryStore } from './lib/storage'

describe('App', () => {
  it('lists the seed workouts until they have been run', async () => {
    render(<App store={createMemoryStore()} />)

    expect(
      await screen.findByRole('heading', { name: 'Your workouts' }),
    ).toBeVisible()
    expect(screen.queryByText('Recently run')).toBeNull()
    const notRun = screen.getByRole('region', { name: 'Not run yet' })
    expect(
      within(notRun)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Tuesday arms', 'Wednesday bodyweight', 'Friday shoulders'])
  })

  it('records a stopped run and shows it on the home screen', async () => {
    const user = userEvent.setup()
    const store = createMemoryStore()
    render(<App store={store} />)

    await user.click(
      await screen.findByRole('button', { name: 'Start Tuesday arms' }),
    )
    expect(screen.getByRole('heading', { name: 'Run / stretch' })).toBeVisible()

    await user.keyboard('{Escape}')
    const dialog = screen.getByRole('alertdialog', { name: 'End this workout?' })
    await user.click(within(dialog).getByRole('button', { name: 'End workout' }))

    const recent = screen.getByRole('region', { name: 'Recently run' })
    expect(within(recent).getByText('Today · stopped at 0:00 of 47:00')).toBeVisible()
    const saved = await store.load()
    expect(saved.runs).toEqual([
      expect.objectContaining({
        workoutName: 'Tuesday arms',
        completed: false,
        totalSeconds: 47 * 60,
      }),
    ])
  })

  it('creates a workout from the standard template', async () => {
    const user = userEvent.setup()
    const store = createMemoryStore()
    render(<App store={store} />)

    await user.click(
      await screen.findByRole('button', { name: 'Create new workout' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'New workout' })
    await user.type(within(dialog).getByLabelText('Name'), 'Thursday legs')
    await user.click(within(dialog).getByRole('button', { name: 'Thursday' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(screen.getByLabelText('Workout name')).toHaveValue('Thursday legs')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('heading', { name: 'Thursday legs' })).toBeVisible()
    expect(screen.getByText('Thu')).toBeVisible()
    const saved = await store.load()
    expect(saved.workouts.at(-1)).toMatchObject({
      name: 'Thursday legs',
      days: ['Thursday'],
    })
    expect(saved.workouts.at(-1)?.blocks).toHaveLength(4)
  })

  it('requires a name for a new workout', async () => {
    const user = userEvent.setup()
    render(<App store={createMemoryStore()} />)

    await user.click(
      await screen.findByRole('button', { name: 'Create new workout' }),
    )
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByText('Give the workout a name.')).toBeVisible()
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })
})

describe('shared links', () => {
  const tuesdayHash =
    '#v=1&n=Shared+arms&d=tu&b=warmup:10m:Jog;circuit:2x30/15:Arms:Curls@15/20,Plank'

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('opens a shared workout in the editor and saves it as new', async () => {
    const user = userEvent.setup()
    const store = createMemoryStore()
    window.location.hash = tuesdayHash
    render(<App store={store} />)

    expect(await screen.findByLabelText('Workout name')).toHaveValue('Shared arms')
    expect(window.location.hash).toBe('')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('heading', { name: 'Shared arms' })).toBeVisible()
    const saved = await store.load()
    expect(saved.workouts.at(-1)).toMatchObject({
      name: 'Shared arms',
      days: ['Tuesday'],
      blocks: [
        { type: 'phase', tone: 'warmup', name: 'Jog', durationSeconds: 600 },
        {
          type: 'circuit',
          rounds: 2,
          workSeconds: 30,
          restSeconds: 15,
          exercises: [
            { name: 'Curls', weights: [15, 20] },
            { name: 'Plank', weights: [null, null] },
          ],
        },
      ],
    })
  })

  it('shows a notice for a link that is not a workout', async () => {
    window.location.hash = '#v=1&n=Broken&b=sprint:5m:a'
    render(<App store={createMemoryStore()} />)

    expect(
      await screen.findByText("This link doesn't contain a valid workout."),
    ).toBeVisible()
    expect(window.location.hash).toBe('')
  })

  it('copies a link from the home screen card', async () => {
    const user = userEvent.setup()
    render(<App store={createMemoryStore()} />)

    await user.click(
      await screen.findByRole('button', { name: 'Share Tuesday arms' }),
    )
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeVisible()
    const copied = await navigator.clipboard.readText()
    expect(copied).toBe(
      `${window.location.origin}/#v=1&n=Tuesday+arms&d=tu&b=` +
        'warmup:25m:Run+%2F+stretch;setup:5m:Set+up+equipment;' +
        'circuit:3x45/15:Arms+and+core:Bicep+curls@15/20,Plank,Tricep+extension@5,Plank;' +
        'cleanup:5m:Put+equipment+away',
    )
  })

  it('copies a link for the unsaved draft from the editor', async () => {
    const user = userEvent.setup()
    render(<App store={createMemoryStore()} />)

    await user.click(
      await screen.findByRole('button', { name: 'Edit Tuesday arms' }),
    )
    const name = screen.getByLabelText('Workout name')
    await user.clear(name)
    await user.type(name, 'Tuesday arms v2')
    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeVisible()
    expect(await navigator.clipboard.readText()).toContain('#v=1&n=Tuesday+arms+v2&')
  })
})
