import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Dumbbell,
  Plus,
  Save,
  Target,
  Timer,
  Trash2,
} from "lucide-react"
import { ExercisePicker } from "@/components/workout/ExercisePicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getExercise } from "@/data/exercises"
import { poseSvg } from "@/data/poses"
import type { AppApi } from "@/lib/appState"
import { formatMinutes, formatTime } from "@/lib/format"
import {
  createEmptyTemplate,
  duplicateTemplate,
  templateDurationSec,
  templateMuscleGroups,
} from "@/lib/template"
import type {
  Difficulty,
  Exercise,
  ExerciseMode,
  Goal,
  WorkoutBlock,
  WorkoutTemplate,
} from "@/types"

const POSE_COLOR = "#68f2c2"

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "fat_loss", label: "Fat Loss" },
  { value: "strength", label: "Strength" },
  { value: "general_fitness", label: "General Fitness" },
  { value: "mobility", label: "Mobility" },
  { value: "recovery", label: "Recovery" },
]

const DIFFICULTY_OPTIONS: Difficulty[] = ["Beginner", "Intermediate", "Advanced"]

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function muscleLabel(m: string): string {
  return m.replace(/_/g, " ")
}

/** Calorie multiplier (kcal/min) by difficulty, for a rough estimated range. */
const KCAL_PER_MIN: Record<Difficulty, number> = {
  Beginner: 5,
  Intermediate: 7,
  Advanced: 9,
}

function blockFromExercise(ex: Exercise): WorkoutBlock {
  return {
    id: crypto.randomUUID(),
    exerciseId: ex.id,
    mode: ex.defaultMode,
    durationSec: ex.defaultDurationSec,
    reps: ex.defaultReps,
    sets: ex.defaultSets,
    restSec: ex.defaultRestSec,
  }
}

/** Build the initial editable template for the given mode/id. */
function initTemplate(
  app: AppApi,
  editTemplateId: string | undefined,
  mode: "edit" | "duplicate" | "new",
): WorkoutTemplate {
  if (mode === "new" || !editTemplateId) {
    return createEmptyTemplate()
  }

  const source = app.getTemplate(editTemplateId)
  if (!source) return createEmptyTemplate()

  if (mode === "duplicate") {
    return duplicateTemplate(source, `${source.name} (copy)`)
  }

  // mode === "edit"
  if (source.isCustom) {
    // Edit in place: keep id, but work on a clone so app state is untouched.
    return deepClone(source)
  }
  // Predefined templates must never be mutated → fall back to duplicate.
  return duplicateTemplate(source, `${source.name} (copy)`)
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: number
  min: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="eyebrow">{label}</Label>
      <Input
        type="number"
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) ? Math.max(min, Math.round(n)) : min)
        }}
        className="h-9"
      />
    </div>
  )
}

export default function WorkoutBuilder({
  app,
  editTemplateId,
  mode,
}: {
  app: AppApi
  editTemplateId?: string
  mode: "edit" | "duplicate" | "new"
}) {
  const [template, setTemplate] = useState<WorkoutTemplate>(() =>
    initTemplate(app, editTemplateId, mode),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  // Re-initialize when the target/mode changes (e.g. switching to duplicate).
  useEffect(() => {
    setTemplate(initTemplate(app, editTemplateId, mode))
    setShowErrors(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTemplateId, mode])

  // True only when editing an existing custom template in place.
  const isEditingExisting =
    mode === "edit" && app.getTemplate(editTemplateId ?? "")?.isCustom === true

  const totalSec = templateDurationSec(template)
  const muscles = useMemo(() => templateMuscleGroups(template), [template])

  const nameValid = template.name.trim().length > 0
  const hasBlocks = template.blocks.length > 0
  const canSave = nameValid && hasBlocks

  function patch(p: Partial<WorkoutTemplate>) {
    setTemplate((t) => ({ ...t, ...p }))
  }

  function patchBlock(id: string, p: Partial<WorkoutBlock>) {
    setTemplate((t) => ({
      ...t,
      blocks: t.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)),
    }))
  }

  function removeBlock(id: string) {
    setTemplate((t) => ({ ...t, blocks: t.blocks.filter((b) => b.id !== id) }))
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setTemplate((t) => {
      const next = [...t.blocks]
      const target = index + dir
      if (target < 0 || target >= next.length) return t
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...t, blocks: next }
    })
  }

  function addExercise(ex: Exercise) {
    setTemplate((t) => ({ ...t, blocks: [...t.blocks, blockFromExercise(ex)] }))
  }

  function handleSave() {
    if (!canSave) {
      setShowErrors(true)
      return
    }
    const now = new Date().toISOString()
    const muscleGroups = templateMuscleGroups(template)
    const estMin = Math.max(1, Math.round(templateDurationSec(template) / 60))
    const perMin = KCAL_PER_MIN[template.difficulty]
    const estimatedCalories: [number, number] = [
      Math.round(estMin * perMin * 0.85),
      Math.round(estMin * perMin * 1.15),
    ]

    const toSave: WorkoutTemplate = {
      ...template,
      name: template.name.trim(),
      isCustom: true,
      updatedAt: now,
      createdAt: template.createdAt ?? now,
      estimatedMinutes: estMin,
      muscleGroups,
      estimatedCalories,
    }
    app.saveCustomTemplate(toSave)
    app.navigate("library")
  }

  function handleDelete() {
    app.deleteCustomTemplate(template.id)
    app.navigate("library")
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-display uppercase tracking-wide">
            {mode === "duplicate"
              ? "Duplicating"
              : isEditingExisting
                ? "Editing"
                : "New workout"}
          </Badge>
          <Badge variant="secondary" className="font-display uppercase tracking-wide">
            Custom
          </Badge>
        </div>

        <h1 className="mt-4 font-display text-5xl uppercase leading-[0.85] sm:text-6xl">
          {mode === "duplicate"
            ? "Duplicate"
            : isEditingExisting
              ? "Edit workout"
              : "Build workout"}
        </h1>

        <div className="mt-6 surface space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wb-name" className="eyebrow">
              Workout name
            </Label>
            <Input
              id="wb-name"
              value={template.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="My custom workout"
              className="h-12 text-lg font-bold"
            />
            {showErrors && !nameValid && (
              <p className="text-xs text-destructive">
                Give your workout a name.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wb-desc" className="eyebrow">
              Description
            </Label>
            <Textarea
              id="wb-desc"
              value={template.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What is this workout about?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="eyebrow">Goal</Label>
              <Select
                value={template.goal}
                onValueChange={(v) => patch({ goal: v as Goal })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="eyebrow">Difficulty</Label>
              <Select
                value={template.difficulty}
                onValueChange={(v) => patch({ difficulty: v as Difficulty })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Live summary */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        <div className="surface flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/15 text-primary">
            <Timer className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-2xl leading-none tabular-nums">
              {formatTime(totalSec)}
            </div>
            <div className="mt-1 eyebrow">{formatMinutes(totalSec)} total</div>
          </div>
        </div>
        <div className="surface flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/15 text-primary">
            <Dumbbell className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-2xl leading-none tabular-nums">
              {template.blocks.length}
            </div>
            <div className="mt-1 eyebrow">Exercises</div>
          </div>
        </div>
        <div className="surface flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/15 text-primary">
            <Target className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-2xl leading-none tabular-nums">
              {muscles.length}
            </div>
            <div className="mt-1 eyebrow">Muscle groups</div>
          </div>
        </div>
      </section>

      {muscles.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {muscles.map((m) => (
            <span
              key={m}
              className="rounded bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            >
              {muscleLabel(m)}
            </span>
          ))}
        </div>
      )}

      {/* Exercise list */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="accent-bar !h-4 !w-1" />
            <h2 className="font-display text-2xl uppercase leading-none">
              Exercises
            </h2>
          </div>
          <Button
            onClick={() => setPickerOpen(true)}
            className="gap-2 font-display uppercase tracking-wide"
          >
            <Plus className="size-4" />
            Add exercise
          </Button>
        </div>

        {showErrors && !hasBlocks && (
          <p className="mb-3 text-xs text-destructive">
            Add at least one exercise before saving.
          </p>
        )}

        <div className="space-y-3">
          {template.blocks.map((block, i) => {
            const ex = getExercise(block.exerciseId)
            const name = ex?.name ?? "Unknown exercise"
            const svg = poseSvg(ex?.illustration ?? "stand", POSE_COLOR)
            const isFirst = i === 0
            const isLast = i === template.blocks.length - 1

            return (
              <div key={block.id} className="surface p-4">
                <div className="flex items-start gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] bg-secondary/40">
                    <div
                      className="size-14"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg uppercase leading-tight">
                        <span className="text-primary">{i + 1}. </span>
                        {name}
                      </h3>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          disabled={isFirst}
                          onClick={() => moveBlock(i, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          disabled={isLast}
                          onClick={() => moveBlock(i, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeBlock(block.id)}
                          aria-label="Remove exercise"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Tabs
                        value={block.mode}
                        onValueChange={(v) =>
                          patchBlock(block.id, { mode: v as ExerciseMode })
                        }
                      >
                        <TabsList className="grid w-full max-w-[220px] grid-cols-2">
                          <TabsTrigger value="reps">Reps</TabsTrigger>
                          <TabsTrigger value="time">Time</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {block.mode === "reps" ? (
                        <NumberField
                          label="Reps"
                          value={block.reps}
                          min={1}
                          onChange={(n) => patchBlock(block.id, { reps: n })}
                        />
                      ) : (
                        <NumberField
                          label="Seconds"
                          value={block.durationSec}
                          min={5}
                          onChange={(n) =>
                            patchBlock(block.id, { durationSec: n })
                          }
                        />
                      )}
                      <NumberField
                        label="Sets"
                        value={block.sets}
                        min={1}
                        onChange={(n) => patchBlock(block.id, { sets: n })}
                      />
                      <NumberField
                        label="Rest (s)"
                        value={block.restSec}
                        min={0}
                        onChange={(n) => patchBlock(block.id, { restSec: n })}
                      />
                    </div>

                    <div className="mt-3 flex flex-col gap-1.5">
                      <Label className="eyebrow">Note (optional)</Label>
                      <Input
                        value={block.note ?? ""}
                        onChange={(e) =>
                          patchBlock(block.id, {
                            note: e.target.value || undefined,
                          })
                        }
                        placeholder="Cue shown in the player…"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {!hasBlocks && (
            <div className="surface flex flex-col items-center gap-3 border-dashed p-10 text-center">
              <Dumbbell className="size-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                No exercises yet. Add your first exercise to get started.
              </p>
              <Button
                onClick={() => setPickerOpen(true)}
                className="gap-2 font-display uppercase tracking-wide"
              >
                <Plus className="size-4" />
                Add your first exercise
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Action bar */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="glow-cta flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[var(--radius)] bg-primary font-display text-lg uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Save className="size-5" />
          Save workout
        </button>
        <button
          type="button"
          onClick={() => app.navigate("library")}
          className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest transition-colors hover:border-primary/40"
        >
          Cancel
        </button>
        {isEditingExisting && (
          <>
            <button
              type="button"
              onClick={() => app.openBuilder(template.id, "duplicate")}
              className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest transition-colors hover:border-primary/40"
            >
              <Copy className="size-4" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius)] px-6 font-display text-sm uppercase tracking-widest text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </>
        )}
      </section>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={addExercise}
      />
    </div>
  )
}
