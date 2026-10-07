import { useMemo, useState, type CSSProperties } from 'react'
import { useDragReorder } from '../hooks/useDragReorder'
import { useWindowChrome } from '../hooks/useWindowChrome'
import {
  formatDuration,
  formatIntervalLength,
  parseDurationInput,
} from '../lib/format'
import {
  equipmentSummary,
  getEquipment,
  normalizeWeights,
  parseWeight,
  setRoundWeight,
} from '../lib/weights'
import {
  WORKOUT_LIMITS,
  blockKindLabel,
  blockListLabel,
  blockTone,
  calculateBlockDuration,
  calculateWorkoutDuration,
  createCircuitBlock,
  createId,
  createPhaseBlock,
  duplicateBlock,
  moveItem,
  toneLabel,
  validateWorkout,
} from '../lib/workout'
import {
  PHASE_TONES,
  type CircuitBlock,
  type CircuitOrder,
  type TimedPhaseBlock,
  type ValidationIssue,
  type Workout,
  type WorkoutBlock,
} from '../types/workout'
import { CommitInput } from './CommitInput'
import { ConfirmDialog } from './ConfirmDialog'
import { DayPicker } from './DayPicker'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  GripIcon,
  PlayIcon,
  PlusIcon,
} from './Icons'
import { Menu, type MenuItem } from './Menu'
import { ShareButton } from './ShareButton'
import { WorkoutStrip } from './WorkoutStrip'

interface WorkoutEditorProps {
  workout: Workout
  isNew: boolean
  onSave: (workout: Workout) => void
  onStart: (workout: Workout) => void
  onDelete: (workout: Workout) => void
  onClose: () => void
}

type HandleProps = ReturnType<ReturnType<typeof useDragReorder>['handleProps']>

function hasIssue(issues: ValidationIssue[], path: string) {
  return issues.some((issue) => issue.path === path)
}

function parseRounds(text: string) {
  const value = Number(text.trim())
  return Number.isInteger(value) && value >= 1 && value <= WORKOUT_LIMITS.maxRounds
    ? value
    : undefined
}

function blockMenuItems(
  block: WorkoutBlock,
  onChange: (block: WorkoutBlock) => void,
  onDuplicate: () => void,
  onRemove: () => void,
): Array<MenuItem | 'separator'> {
  const kinds: MenuItem[] =
    block.type === 'phase'
      ? PHASE_TONES.map((tone) => ({
          label: toneLabel(tone),
          tone,
          checked: block.tone === tone,
          onSelect: () => onChange({ ...block, tone }),
        }))
      : []
  return [
    ...kinds,
    ...(kinds.length > 0 ? (['separator'] as const) : []),
    { label: 'Duplicate', onSelect: onDuplicate },
    { label: 'Delete', danger: true, onSelect: onRemove },
  ]
}

interface BlockProps<T extends WorkoutBlock> {
  block: T
  index: number
  issues: ValidationIssue[]
  dragging: boolean
  rowRef: (element: HTMLElement | null) => void
  handle: HandleProps
  onChange: (block: WorkoutBlock) => void
  onDuplicate: () => void
  onRemove: () => void
}

function TimedBlockRow({
  block,
  index,
  issues,
  dragging,
  rowRef,
  handle,
  onChange,
  onDuplicate,
  onRemove,
}: BlockProps<TimedPhaseBlock>) {
  const path = `blocks.${index}`
  return (
    <section
      className="block-card block-row"
      ref={rowRef}
      data-dragging={dragging || undefined}
      aria-label={`${blockKindLabel(block)}: ${block.name}`}
    >
      <button
        className="grip"
        type="button"
        aria-label={`Move ${block.name}. Drag, or use the arrow keys.`}
        {...handle}
      >
        <GripIcon />
      </button>
      <i className="swatch block-swatch" data-tone={block.tone} />
      <div className="block-title">
        <span className="block-kind">{blockKindLabel(block)}</span>
        <input
          className="inline-input block-name"
          value={block.name}
          maxLength={WORKOUT_LIMITS.maxNameLength}
          aria-label="Block name"
          aria-invalid={hasIssue(issues, `${path}.name`) || undefined}
          onChange={(event) => onChange({ ...block, name: event.target.value })}
        />
      </div>
      <CommitInput
        className="cell-input block-duration"
        value={block.durationSeconds}
        format={formatDuration}
        parse={(text) => parseDurationInput(text, 'minutes')}
        onCommit={(durationSeconds) => onChange({ ...block, durationSeconds })}
        invalid={hasIssue(issues, `${path}.durationSeconds`)}
        inputMode="numeric"
        aria-label={`${block.name} duration`}
      />
      <Menu
        label={`${block.name} options`}
        items={blockMenuItems(block, onChange, onDuplicate, onRemove)}
      />
    </section>
  )
}

interface CircuitCardProps extends BlockProps<CircuitBlock> {
  collapsed: boolean
  onToggle: () => void
}

function CircuitCard({
  block,
  index,
  issues,
  dragging,
  rowRef,
  handle,
  collapsed,
  onToggle,
  onChange,
  onDuplicate,
  onRemove,
}: CircuitCardProps) {
  const path = `blocks.${index}`
  const exerciseIds = block.exercises.map((exercise) => exercise.id)
  const reorder = useDragReorder(exerciseIds, (from, to) =>
    onChange({ ...block, exercises: moveItem(block.exercises, from, to) }),
  )
  const rounds = Array.from({ length: block.rounds }, (_, round) => round)

  const updateExercise = (exerciseIndex: number, exercise: CircuitBlock['exercises'][number]) =>
    onChange({
      ...block,
      exercises: block.exercises.map((current, currentIndex) =>
        currentIndex === exerciseIndex ? exercise : current,
      ),
    })

  return (
    <section
      className="block-card circuit-card"
      ref={rowRef}
      data-dragging={dragging || undefined}
      aria-label={`Circuit: ${block.name}`}
    >
      <div className="block-row">
        <button
          className="grip"
          type="button"
          aria-label={`Move ${block.name}. Drag, or use the arrow keys.`}
          {...handle}
        >
          <GripIcon />
        </button>
        <i className="swatch block-swatch" data-tone="work" />
        <div className="block-title">
          <span className="block-kind">
            Circuit · {formatDuration(calculateBlockDuration(block))}
          </span>
          <input
            className="inline-input block-name"
            value={block.name}
            maxLength={WORKOUT_LIMITS.maxNameLength}
            aria-label="Circuit name"
            aria-invalid={hasIssue(issues, `${path}.name`) || undefined}
            onChange={(event) => onChange({ ...block, name: event.target.value })}
          />
        </div>
        <Menu
          label={`${block.name} options`}
          items={blockMenuItems(block, onChange, onDuplicate, onRemove)}
        />
        <button
          className="icon-only"
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${block.name}` : `Collapse ${block.name}`}
          onClick={onToggle}
        >
          {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </button>
      </div>

      {!collapsed && (
        <div className="circuit-body">
          <div className="circuit-settings">
            <label>
              Rounds
              <CommitInput
                className="cell-input is-rounds"
                value={block.rounds}
                format={String}
                parse={parseRounds}
                inputMode="numeric"
                invalid={hasIssue(issues, `${path}.rounds`)}
                onCommit={(roundCount) =>
                  onChange({
                    ...block,
                    rounds: roundCount,
                    exercises: block.exercises.map((exercise) => ({
                      ...exercise,
                      weights: normalizeWeights(exercise.weights, roundCount),
                    })),
                  })
                }
              />
            </label>
            <label>
              Work
              <CommitInput
                className="cell-input is-seconds"
                value={block.workSeconds}
                format={formatIntervalLength}
                parse={(text) => parseDurationInput(text, 'seconds')}
                invalid={hasIssue(issues, `${path}.workSeconds`)}
                onCommit={(workSeconds) => onChange({ ...block, workSeconds })}
              />
            </label>
            <label>
              Rest
              <CommitInput
                className="cell-input is-seconds"
                value={block.restSeconds}
                format={formatIntervalLength}
                parse={(text) => parseDurationInput(text, 'seconds')}
                invalid={hasIssue(issues, `${path}.restSeconds`)}
                onCommit={(restSeconds) => onChange({ ...block, restSeconds })}
              />
            </label>
            <label>
              Order
              <select
                className="cell-select"
                value={block.order}
                onChange={(event) =>
                  onChange({ ...block, order: event.target.value as CircuitOrder })
                }
              >
                <option value="circuit">Circuit</option>
                <option value="sets">Sets</option>
              </select>
            </label>
          </div>

          <div className="exercise-table">
            <div
              className="exercise-grid"
              style={{ '--rounds': block.rounds } as CSSProperties}
            >
              <div className="exercise-row is-head" aria-hidden="true">
                <span />
                <span>Exercise</span>
                {rounds.map((round) => (
                  <span className="is-round" key={round}>
                    R{round + 1}
                  </span>
                ))}
                <span />
              </div>
              {block.exercises.map((exercise, exerciseIndex) => {
                const exercisePath = `${path}.exercises.${exerciseIndex}`
                return (
                  <div
                    className="exercise-row"
                    key={exercise.id}
                    ref={reorder.rowRef(exercise.id)}
                    data-dragging={reorder.draggingId === exercise.id || undefined}
                  >
                    <button
                      className="grip"
                      type="button"
                      aria-label={`Move ${exercise.name}. Drag, or use the arrow keys.`}
                      {...reorder.handleProps(exercise.id)}
                    >
                      <GripIcon />
                    </button>
                    <input
                      className="cell-input is-name"
                      value={exercise.name}
                      maxLength={WORKOUT_LIMITS.maxNameLength}
                      aria-label={`Exercise ${exerciseIndex + 1}`}
                      aria-invalid={hasIssue(issues, `${exercisePath}.name`) || undefined}
                      onChange={(event) =>
                        updateExercise(exerciseIndex, {
                          ...exercise,
                          name: event.target.value,
                        })
                      }
                    />
                    {rounds.map((round) => (
                      <CommitInput
                        className="cell-input is-weight"
                        key={round}
                        value={exercise.weights[round] ?? null}
                        format={(weight) => (weight === null ? '' : String(weight))}
                        parse={parseWeight}
                        placeholder="—"
                        inputMode="decimal"
                        aria-label={`${exercise.name || 'Exercise'}, round ${round + 1} weight in lb`}
                        invalid={hasIssue(issues, `${exercisePath}.weights.${round}`)}
                        onCommit={(weight) =>
                          updateExercise(exerciseIndex, {
                            ...exercise,
                            weights: setRoundWeight(
                              normalizeWeights(exercise.weights, block.rounds),
                              round,
                              weight,
                            ),
                          })
                        }
                      />
                    ))}
                    <button
                      className="icon-only is-remove"
                      type="button"
                      aria-label={`Remove ${exercise.name || 'exercise'}`}
                      onClick={() =>
                        onChange({
                          ...block,
                          exercises: block.exercises.filter(
                            (_, currentIndex) => currentIndex !== exerciseIndex,
                          ),
                        })
                      }
                    >
                      <CloseIcon />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="circuit-footer">
            <button
              className="text-action"
              type="button"
              disabled={block.exercises.length >= WORKOUT_LIMITS.maxExercisesPerCircuit}
              onClick={() =>
                onChange({
                  ...block,
                  exercises: [
                    ...block.exercises,
                    {
                      id: createId('exercise'),
                      name: `Exercise ${block.exercises.length + 1}`,
                      weights: normalizeWeights([], block.rounds),
                    },
                  ],
                })
              }
            >
              <PlusIcon />
              Add exercise
            </button>
            <span className="meta">Weights in lb · blank = bodyweight</span>
          </div>
          {hasIssue(issues, `${path}.exercises`) && (
            <p className="field-error">Add at least one exercise.</p>
          )}
        </div>
      )}
    </section>
  )
}

export function WorkoutEditor({
  workout,
  isNew,
  onSave,
  onStart,
  onDelete,
  onClose,
}: WorkoutEditorProps) {
  const [draft, setDraft] = useState(workout)
  const [initialJson] = useState(() => JSON.stringify(workout))
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [confirming, setConfirming] = useState<'delete' | 'discard' | null>(null)
  const issues = useMemo(() => validateWorkout(draft), [draft])
  const valid = issues.length === 0
  const dirty = isNew || JSON.stringify(draft) !== initialJson
  const equipment = equipmentSummary(getEquipment(draft))
  const blockIds = draft.blocks.map((block) => block.id)

  useWindowChrome('HIIT · Edit workout')

  const setBlocks = (update: (blocks: WorkoutBlock[]) => WorkoutBlock[]) =>
    setDraft((current) => ({ ...current, blocks: update(current.blocks) }))

  const reorder = useDragReorder(blockIds, (from, to) =>
    setBlocks((blocks) => moveItem(blocks, from, to)),
  )

  const addBlock = (block: WorkoutBlock) => setBlocks((blocks) => [...blocks, block])

  return (
    <div className="editor">
      <header className="editor-toolbar">
        <button
          className="editor-back"
          type="button"
          onClick={() => (dirty ? setConfirming('discard') : onClose())}
        >
          <ArrowLeftIcon />
          Workouts
        </button>
        <h1 className="sr-only">Edit workout</h1>
        <div className="editor-toolbar-actions">
          <button
            className="text-action is-danger"
            type="button"
            onClick={() => setConfirming('delete')}
          >
            Delete
          </button>
          <ShareButton workout={draft} variant="text" disabled={!valid} />
          <button
            className="button button-heat"
            type="button"
            disabled={!valid}
            onClick={() => onSave(draft)}
          >
            Save
          </button>
        </div>
      </header>

      <div className="editor-body">
        <div className="editor-scroll">
          <div className="editor-main">
            <input
              className="editor-name"
              value={draft.name}
              maxLength={WORKOUT_LIMITS.maxNameLength}
              aria-label="Workout name"
              aria-invalid={hasIssue(issues, 'name') || undefined}
              placeholder="Workout name"
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
            <DayPicker
              days={draft.days}
              compact
              onChange={(days) => setDraft((current) => ({ ...current, days }))}
            />

            {!valid && (
              <p className="editor-issues" role="status">
                {issues[0].message}
                {issues.length > 1 &&
                  ` ${issues.length - 1} more ${issues.length === 2 ? 'field needs' : 'fields need'} attention.`}
              </p>
            )}

            <div className="block-list">
              {draft.blocks.map((block, index) => {
                const shared = {
                  index,
                  issues,
                  dragging: reorder.draggingId === block.id,
                  rowRef: reorder.rowRef(block.id),
                  handle: reorder.handleProps(block.id),
                  onChange: (next: WorkoutBlock) =>
                    setBlocks((blocks) =>
                      blocks.map((current) => (current.id === block.id ? next : current)),
                    ),
                  onDuplicate: () =>
                    setBlocks((blocks) => {
                      const at = blocks.findIndex((current) => current.id === block.id)
                      return [
                        ...blocks.slice(0, at + 1),
                        duplicateBlock(block),
                        ...blocks.slice(at + 1),
                      ]
                    }),
                  onRemove: () =>
                    setBlocks((blocks) =>
                      blocks.filter((current) => current.id !== block.id),
                    ),
                }
                return block.type === 'phase' ? (
                  <TimedBlockRow key={block.id} block={block} {...shared} />
                ) : (
                  <CircuitCard
                    key={block.id}
                    block={block}
                    collapsed={collapsed.has(block.id)}
                    onToggle={() =>
                      setCollapsed((ids) => {
                        const next = new Set(ids)
                        if (!next.delete(block.id)) {
                          next.add(block.id)
                        }
                        return next
                      })
                    }
                    {...shared}
                  />
                )
              })}
            </div>

            <div className="add-blocks">
              <button
                className="text-action"
                type="button"
                disabled={draft.blocks.length >= WORKOUT_LIMITS.maxBlocks}
                onClick={() => addBlock(createPhaseBlock())}
              >
                <PlusIcon />
                Timed block
              </button>
              <button
                className="text-action"
                type="button"
                disabled={draft.blocks.length >= WORKOUT_LIMITS.maxBlocks}
                onClick={() => addBlock(createCircuitBlock('Circuit', ['Exercise 1']))}
              >
                <PlusIcon />
                Circuit
              </button>
            </div>
          </div>
        </div>

        <aside className="editor-rail" aria-label="Summary">
          <p className="meta">Total</p>
          <p className="editor-total">
            {formatDuration(calculateWorkoutDuration(draft))}
          </p>
          <WorkoutStrip workout={draft} detail="blocks" className="is-small" />
          <ul className="editor-breakdown">
            {draft.blocks.map((block) => (
              <li key={block.id}>
                <i className="swatch" data-tone={blockTone(block)} />
                <span>{blockListLabel(block)}</span>
                {formatDuration(calculateBlockDuration(block))}
              </li>
            ))}
          </ul>
          <p className="field-label">Equipment</p>
          <p className="editor-equipment">
            {equipment.length > 0
              ? equipment.map((line) => <span key={line}>{line}</span>)
              : 'Bodyweight only'}
          </p>
          <button
            className="button button-dark editor-start"
            type="button"
            disabled={!valid}
            onClick={() => onStart(draft)}
          >
            <PlayIcon />
            Start
          </button>
        </aside>
      </div>

      {confirming === 'discard' && (
        <ConfirmDialog
          title={isNew ? 'Discard this workout?' : 'Discard your changes?'}
          body={
            isNew
              ? `${draft.name || 'This workout'} hasn't been saved yet.`
              : `Your edits to ${workout.name} won't be saved.`
          }
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          danger
          onConfirm={onClose}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'delete' && (
        <ConfirmDialog
          title={isNew ? 'Discard this workout?' : `Delete ${workout.name}?`}
          body={
            isNew
              ? `${draft.name || 'This workout'} hasn't been saved yet.`
              : 'This removes the workout and its run history from this laptop.'
          }
          confirmLabel={isNew ? 'Discard' : 'Delete'}
          danger
          onConfirm={() => (isNew ? onClose() : onDelete(workout))}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
