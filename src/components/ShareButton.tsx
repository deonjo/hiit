import { useEffect, useRef, useState } from 'react'
import { workoutLink } from '../lib/share'
import type { Workout } from '../types/workout'
import { CheckIcon, ShareIcon } from './Icons'

interface ShareButtonProps {
  workout: Workout
  /** `icon` is the square card button; `text` sits in the editor toolbar. */
  variant: 'icon' | 'text'
  disabled?: boolean
}

type ShareStatus = 'idle' | 'copied' | 'failed'

const STATUS_LABELS: Record<ShareStatus, string> = {
  idle: 'Share',
  copied: 'Link copied',
  failed: "Couldn't copy link",
}

/** The share sheet, where it exists and the device is handheld. */
function canUseShareSheet() {
  return (
    typeof navigator.share === 'function' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

/**
 * The pre-clipboard-API way to copy, for plain-http hosts on a home
 * network and browsers that deny the clipboard permission.
 */
function copyWithSelection(text: string) {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return copyWithSelection(url)
  }
}

/**
 * Hands the link to the share sheet on phones and tablets, and copies it
 * to the clipboard everywhere else. Returns whether to say "copied".
 */
async function shareLink(url: string, title: string): Promise<ShareStatus> {
  if (canUseShareSheet()) {
    try {
      await navigator.share({ title, url })
      return 'idle'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'idle'
      }
    }
  }
  return (await copyLink(url)) ? 'copied' : 'failed'
}

export function ShareButton({ workout, variant, disabled }: ShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const share = async () => {
    const result = await shareLink(
      workoutLink(workout, window.location.href),
      workout.name,
    )
    setStatus(result)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus('idle'), 2000)
  }

  const label = STATUS_LABELS[status]
  const announcement = status === 'idle' ? '' : label
  const Icon = status === 'copied' ? CheckIcon : ShareIcon

  if (variant === 'icon') {
    return (
      <>
        <button
          className="icon-button"
          type="button"
          onClick={share}
          disabled={disabled}
          aria-label={status === 'idle' ? `Share ${workout.name}` : label}
        >
          <Icon />
        </button>
        <span className="sr-only" role="status">
          {announcement}
        </span>
      </>
    )
  }

  return (
    <>
      <button
        className="text-action editor-share"
        type="button"
        onClick={share}
        disabled={disabled}
        data-status={status}
      >
        <Icon />
        {label}
      </button>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </>
  )
}
