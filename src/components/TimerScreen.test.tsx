import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeedWorkouts } from '../data/seed'
import { CALLOUT_GAP_MS, cuePlayer } from '../lib/cues'
import { createCircuitBlock, createPhaseBlock } from '../lib/workout'
import type { Workout } from '../types/workout'
import { TimerScreen } from './TimerScreen'

const tuesday = createSeedWorkouts(0)[0]

function renderTimer(workout: Workout = tuesday) {
  const props = {
    workout,
    onProgress: vi.fn(),
    onExit: vi.fn(),
    onRestart: vi.fn(),
  }
  render(<TimerScreen {...props} />)
  return props
}

function queueRows() {
  const rail = screen.getByRole('complementary', { name: 'Queue' })
  return within(rail).getAllByRole('listitem')
}

function installFakeClock() {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'],
  })
}

/** Advances the fake clock, rendering every 100 ms tick as the browser does. */
function play(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    act(() => vi.advanceTimersByTime(100))
  }
}

/** jsdom can't speak, so this records what would be said aloud. */
function stubSpeech() {
  const spoken: string[] = []
  const cancel = vi.fn()
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      constructor(text: string) {
        this.text = text
      }
    },
  )
  vi.stubGlobal('speechSynthesis', {
    speaking: false,
    pending: false,
    speak: (utterance: { text: string }) => spoken.push(utterance.text),
    cancel,
  })
  return { spoken, cancel }
}

afterEach(() => vi.unstubAllGlobals())

describe('TimerScreen', () => {
  it('starts running on open, with the warm-up block', () => {
    renderTimer()

    expect(screen.getByRole('heading', { name: 'Run / stretch' })).toBeVisible()
    expect(screen.getByText('Warm-up · block 1 of 4')).toBeVisible()
    expect(screen.getByRole('timer')).toHaveTextContent('25:00')
    expect(screen.getByRole('button', { name: 'Pause workout' })).toBeVisible()
    expect(queueRows().map((row) => row.textContent)).toEqual([
      'Setup5:00',
      'Circuit12:00',
      'Cleanup5:00',
    ])
  })

  it('keeps the remaining time on one line', () => {
    renderTimer()
    const rail = screen.getByRole('complementary', { name: 'Queue' })

    expect(within(rail).getByText('47:00', { selector: '.sr-only' })).toBeVisible()
    expect(rail.querySelector('.rail-remaining-time .digits')).toHaveTextContent('47:00')
  })

  it('pauses and resumes with the space bar', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard(' ')
    expect(screen.getByText('Paused')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeVisible()

    await user.keyboard(' ')
    expect(screen.queryByText('Paused')).toBeNull()
  })

  it('shows the exercise and weight, then what is next during rest', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByText('Round 1 of 3 · exercise 1 of 4')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Bicep curls' })).toBeVisible()
    expect(screen.getByText('15 lb', { selector: '.weight-badge' })).toBeVisible()
    expect(queueRows()[0]).toHaveAttribute('data-highlighted', 'true')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('heading', { name: 'Rest' })).toBeVisible()
    expect(screen.getByText('Next: plank')).toBeVisible()
    expect(screen.queryByText(/^Grab/)).toBeNull()
  })

  it('says what is first, with its weight, during setup', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Setup · block 2 of 4')).toBeVisible()
    expect(screen.getByText('Next: bicep curls · 15 lb')).toBeVisible()
  })

  it('calls out a weight change at the end of a round', async () => {
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard('{ArrowRight}'.repeat(9))
    expect(screen.getByText('End of round 1')).toBeVisible()
    expect(screen.getByText('Next: bicep curls')).toBeVisible()
    expect(screen.getByText('Grab 20 lb')).toBeVisible()
  })

  it('restarts the interval on ←, and goes back on a second press', async () => {
    const user = userEvent.setup()
    renderTimer()
    await user.keyboard('{ArrowRight}{ArrowRight}')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('heading', { name: 'Bicep curls' })).toBeVisible()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('Setup · block 2 of 4')).toBeVisible()
    expect(screen.getByRole('button', { name: '5 lb dumbbells' })).toBeVisible()
  })

  it('toggles focus mode and mute, ignoring modified keys', async () => {
    const user = userEvent.setup()
    renderTimer()
    const mute = screen.getByRole('button', { name: 'Mute cues' })

    await user.keyboard('{Meta>}m{/Meta}')
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    await user.keyboard('m')
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('f')
    expect(screen.getByRole('button', { name: 'Focus mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('beeps three times before each phase change, pitched for what is next', () => {
    installFakeClock()
    const beep = vi.spyOn(cuePlayer, 'playCountdown').mockResolvedValue()
    try {
      renderTimer()
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })

      play(41_000)
      expect(beep).not.toHaveBeenCalled()

      play(1_000)
      expect(beep).toHaveBeenCalledOnce()

      // A restarted interval counts down out loud again.
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      play(45_000)
      expect(screen.getByRole('heading', { name: 'Rest' })).toBeVisible()
      expect(beep.mock.calls).toEqual(Array(4).fill(['rest']))

      play(15_000)
      expect(screen.getByRole('heading', { name: 'Plank' })).toBeVisible()
      expect(beep.mock.calls.slice(4)).toEqual([['work'], ['work'], ['work']])
    } finally {
      beep.mockRestore()
      vi.useRealTimers()
    }
  })

  it('calls out each interval as it starts, and what is next during rests', () => {
    installFakeClock()
    const { spoken } = stubSpeech()
    try {
      renderTimer()
      expect(spoken).toEqual(['Warm-up, 25 minutes.'])

      for (let skip = 0; skip < 3; skip += 1) {
        play(1_000)
        fireEvent.keyDown(window, { key: 'ArrowRight' })
      }
      expect(spoken).toEqual([
        'Warm-up, 25 minutes.',
        'Setup, 5 minutes.',
        'Bicep curls, 15 pounds.',
        'Rest. Next: plank.',
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('says only where you land when skipping quickly', () => {
    installFakeClock()
    const { spoken } = stubSpeech()
    try {
      renderTimer()
      for (let skip = 0; skip < 9; skip += 1) {
        fireEvent.keyDown(window, { key: 'ArrowRight' })
      }
      expect(screen.getByText('End of round 1')).toBeVisible()
      expect(spoken).toEqual(['Warm-up, 25 minutes.'])

      play(CALLOUT_GAP_MS)
      expect(spoken).toEqual([
        'Warm-up, 25 minutes.',
        'Rest. Next: bicep curls. Grab 20 pounds.',
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('cuts off the callout for an interval you skip', () => {
    installFakeClock()
    const { spoken, cancel } = stubSpeech()
    try {
      renderTimer()
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(cancel).toHaveBeenCalledOnce()

      play(CALLOUT_GAP_MS)
      expect(spoken).toEqual(['Warm-up, 25 minutes.', 'Setup, 5 minutes.'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes quiet the moment you pause, even mid-skip', () => {
    installFakeClock()
    const { spoken, cancel } = stubSpeech()
    try {
      renderTimer()
      fireEvent.keyDown(window, { key: ' ' })
      expect(cancel).toHaveBeenCalledOnce()

      // A callout still waiting out a quick skip is dropped, too.
      fireEvent.keyDown(window, { key: ' ' })
      play(1_000)
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: ' ' })
      play(CALLOUT_GAP_MS)
      expect(screen.getByText('Paused')).toBeVisible()
      expect(spoken).toEqual(['Warm-up, 25 minutes.', 'Setup, 5 minutes.'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('calls out what is next before a long block ends, and again on restart', () => {
    installFakeClock()
    const beep = vi.spyOn(cuePlayer, 'playCountdown').mockResolvedValue()
    const { spoken } = stubSpeech()
    try {
      renderTimer({
        id: 'short',
        name: 'Short',
        days: [],
        createdAt: 0,
        blocks: [
          createPhaseBlock('setup', 'Set up', 30),
          { ...createCircuitBlock('Circuit', ['Jumping jacks']), rounds: 1 },
        ],
      })
      expect(spoken).toEqual(['Setup, 30 seconds.'])

      play(19_900)
      expect(spoken).toHaveLength(1)
      play(100)
      expect(spoken.at(-1)).toBe('Up next: jumping jacks.')

      play(10_000)
      expect(spoken.at(-1)).toBe('Jumping jacks.')

      // Restarting the interval calls it out again.
      play(2_000)
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      expect(spoken.slice(1)).toEqual([
        'Up next: jumping jacks.',
        'Jumping jacks.',
        'Jumping jacks.',
      ])
    } finally {
      beep.mockRestore()
      vi.useRealTimers()
    }
  })

  it('stops talking when muted', async () => {
    const { spoken, cancel } = stubSpeech()
    const user = userEvent.setup()
    renderTimer()

    await user.keyboard('m')
    expect(cancel).toHaveBeenCalledOnce()
    await user.keyboard('{ArrowRight}')
    expect(spoken).toEqual(['Warm-up, 25 minutes.'])
  })

  it('asks before ending, then reports the stopped run', async () => {
    const user = userEvent.setup()
    const props = renderTimer()

    await user.keyboard('{Escape}')
    const dialog = screen.getByRole('alertdialog', { name: 'End this workout?' })
    expect(within(dialog).getByRole('button', { name: 'Keep going' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Warm-up · block 1 of 4')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'End workout' }))
    expect(props.onProgress).toHaveBeenLastCalledWith(0, false)
    expect(props.onExit).toHaveBeenCalledOnce()
  })

  it('holds still and quiet while asking whether to end', () => {
    installFakeClock()
    const beep = vi.spyOn(cuePlayer, 'playCountdown').mockResolvedValue()
    try {
      renderTimer()
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      play(40_000)

      fireEvent.keyDown(window, { key: 'Escape' })
      play(10_000)
      const dialog = screen.getByRole('alertdialog', { name: 'End this workout?' })
      expect(dialog).toHaveTextContent('stopped at 30:40 of 47:00')
      expect(beep).not.toHaveBeenCalled()

      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep going' }))
      play(5_000)
      expect(beep.mock.calls).toEqual(Array(3).fill(['rest']))
      expect(screen.getByRole('heading', { name: 'Rest' })).toBeVisible()
    } finally {
      beep.mockRestore()
      vi.useRealTimers()
    }
  })
})
