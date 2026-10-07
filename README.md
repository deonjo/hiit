# HIIT

A full-screen, installable HIIT timer built around a simple visual signal: every phase paints the whole window its own color, so you can tell where you are in a workout from across the room.

| Phase | Color |
| --- | --- |
| Warm-up | Char `#1A0A05` |
| Setup and cleanup | Flash `#FFD23F` |
| Work | Heat `#FF4D2E` |
| Rest and recovery | Cobalt `#2337E8` |

## Starting workouts

On first launch, HIIT saves three 47-minute workouts on this laptop:

| Workout | Warm-up | Setup | Circuit, 3 rounds of 45s / 15s | Cleanup |
| --- | --- | --- | --- | --- |
| Tuesday arms | 25 min | 5 min | Bicep curls (15, 20, 20 lb), plank, tricep extension (5 lb), plank | 5 min |
| Wednesday bodyweight | 25 min | 5 min | Pull-ups, jump rope, push-ups, V-sits | 5 min |
| Friday shoulders | 25 min | 5 min | Front raise (10, 15, 15 lb), side plank left, lateral raise (10, 15, 15 lb), side plank right | 5 min |

## Features

- Phase-colored timer with a queue rail that previews what's next
- Weight badges, a setup checklist built from the workout's weights with the first exercise named under it, and a callout when a weight changes between rounds
- Spoken callouts: each interval is named as it starts, rests say what's next and which weight to grab, and long blocks give a heads-up 10 seconds before they end
- Three short beeps before every phase change, pitched differently for work and rest
- Type that scales with the window, at the same sizes in every phase
- Timing computed from timestamps, so background tabs don't drift
- Screen wake lock while a workout runs, and a title bar that takes the phase color in the installed app
- Workout editor with timed blocks and circuits, per-round weights, circuit or sets order, and drag-to-reorder
- Run history: completed and stopped runs, shown on the home screen

Workouts and run history are stored in IndexedDB on this device. Fonts and assets are cached by the service worker, so the app works offline.

## Sharing workouts

Every workout card and the editor have a Share button. On a laptop it copies a link to the clipboard; on a phone or tablet it opens the share sheet. Opening the link on another device shows the workout in the editor, unsaved, so the recipient can look it over before saving. Run history is not shared.

The whole workout lives in the URL fragment, so no server is involved and the link is readable:

```
https://<host>/#v=1&n=Tuesday+arms&d=tu&b=warmup:25m:Run+%2F+stretch;setup:5m:Set+up+equipment;circuit:3x45/15:Arms+and+core:Bicep+curls@15/20,Plank,Tricep+extension@5,Plank;cleanup:5m:Put+equipment+away
```

| Part | Meaning |
| --- | --- |
| `v=1` | Format version |
| `n=` | Workout name, percent-encoded with `+` for spaces |
| `d=` | Repeat days: `mo`, `tu`, `we`, `th`, `fr`, `sa`, `su` |
| `b=` | Blocks separated by `;`, with fields separated by `:` |
| `warmup:25m:name` | A timed block. Kinds are `warmup`, `setup`, `cleanup`, `recovery`, and `timed`. Durations are `25m` for whole minutes, otherwise seconds; `1m30` also works. |
| `circuit:3x45/15:name:exercises` | A circuit of 3 rounds, 45 s work, 15 s rest. `sets` in place of `circuit` finishes each exercise before moving on. |
| `Bicep+curls@15/20,Plank` | Exercises separated by `,`. Weights in lb follow `@`, one per round separated by `/`. Trailing repeats are dropped, so `@15/20` is 15, 20, 20. No `@` means bodyweight. |

## Keyboard

| Key | Action |
| --- | --- |
| Space | Pause and resume |
| → | Next interval, or next block during long blocks |
| ← | Restart the current interval; press twice for the previous one |
| `F` | Focus mode: hide the queue rail |
| `M` | Mute cues |
| Esc | End the workout, with confirmation; the workout pauses while you decide |

## Development

The repository uses the Node version in `.tool-versions`.

```sh
npm install
npm run dev
```

Validation commands:

```sh
npm run lint
npm test
npm run build
```

The production build is written to `dist/`. Preview it locally with `npm run preview`.
