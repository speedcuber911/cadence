import { useState } from "react"
import {
  ArrowLeft,
  Clock,
  Copy,
  Dumbbell,
  Flame,
  ListChecks,
  Pencil,
  Play,
  Repeat,
  Target,
  Timer,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getExercise } from "@/data/exercises"
import { poseSvg } from "@/data/poses"
import type { AppApi } from "@/lib/appState"
import { formatMinutes, formatTime } from "@/lib/format"
import { templateDurationSec, templateMuscleGroups } from "@/lib/template"
import type { Difficulty, ScalingOption, WorkoutTemplate } from "@/types"

const GOAL_LABEL: Record<WorkoutTemplate["goal"], string> = {
  fat_loss: "Fat Loss",
  strength: "Strength",
  general_fitness: "General Fitness",
  mobility: "Mobility",
  recovery: "Recovery",
}

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Beginner: "text-work border-work/40 bg-work/10",
  Intermediate: "text-rest border-rest/40 bg-rest/10",
  Advanced: "text-destructive border-destructive/40 bg-destructive/10",
}

const POSE_COLOR = "#68f2c2"

function muscleLabel(m: string): string {
  return m.replace(/_/g, " ")
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="surface flex items-center gap-3 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-secondary/60 text-recovery">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-2xl leading-none tabular-nums">
          {value}
        </div>
        <div className="mt-1 eyebrow">{label}</div>
      </div>
    </div>
  )
}

export default function WorkoutDetail({
  app,
  template,
}: {
  app: AppApi
  template: WorkoutTemplate
}) {
  const [scaling, setScaling] = useState<ScalingOption>("standard")

  const totalSec = templateDurationSec(template)
  const muscles = templateMuscleGroups(template)
  const totalSets = template.blocks.reduce((sum, b) => sum + b.sets, 0)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => app.navigate("library")}
        className="mb-6 inline-flex items-center gap-2 px-2 py-1 eyebrow text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to library
      </button>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-2.5 py-0.5 font-display text-xs uppercase tracking-widest ${DIFFICULTY_STYLE[template.difficulty]}`}
          >
            {template.difficulty}
          </span>
          <span className="rounded bg-secondary px-2.5 py-0.5 font-display text-xs uppercase tracking-widest text-muted-foreground">
            {GOAL_LABEL[template.goal]}
          </span>
          {template.isCustom && (
            <span className="rounded bg-secondary px-2.5 py-0.5 font-display text-xs uppercase tracking-widest text-muted-foreground">
              Custom
            </span>
          )}
        </div>
        <h1 className="mt-4 font-display text-5xl uppercase leading-[0.85] sm:text-6xl">
          {template.name}
        </h1>
        {template.description && (
          <p className="mt-4 max-w-2xl text-muted-foreground">
            {template.description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-display text-lg">
          <span className="inline-flex items-baseline gap-1.5">
            <Clock className="size-4 translate-y-0.5 text-primary" />
            {template.estimatedMinutes}
            <span className="text-sm text-muted-foreground">MIN</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <Flame className="size-4 translate-y-0.5 text-primary" />
            {template.estimatedCalories[0]}–{template.estimatedCalories[1]}
            <span className="text-sm text-muted-foreground">KCAL</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <Dumbbell className="size-4 translate-y-0.5 text-primary" />
            <span className="uppercase">{template.equipment.join(", ")}</span>
          </span>
        </div>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<Timer className="size-5" />}
          label={`${formatMinutes(totalSec)} total`}
          value={formatTime(totalSec)}
        />
        <Stat
          icon={<Dumbbell className="size-5" />}
          label="Exercises"
          value={String(template.blocks.length)}
        />
        <Stat
          icon={<ListChecks className="size-5" />}
          label="Total sets"
          value={String(totalSets)}
        />
        <Stat
          icon={<Target className="size-5" />}
          label="Muscle groups"
          value={String(muscles.length)}
        />
      </section>

      {muscles.length > 0 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {muscles.map((m) => (
            <span
              key={m}
              className="rounded bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide capitalize text-muted-foreground"
            >
              {muscleLabel(m)}
            </span>
          ))}
        </div>
      )}

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="accent-bar !h-4 !w-1" />
          <h2 className="eyebrow">Exercises</h2>
        </div>
        <div className="space-y-3">
          {template.blocks.map((block, i) => {
            const ex = getExercise(block.exerciseId)
            const name = ex?.name ?? "Unknown exercise"
            const svg = poseSvg(ex?.illustration ?? "stand", POSE_COLOR)
            const work =
              block.mode === "time"
                ? `${block.durationSec}s`
                : `${block.sets} × ${block.reps}`
            const tip = ex?.techniqueTips[0]

            return (
              <div
                key={block.id}
                className="surface flex items-start gap-4 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] bg-secondary/40">
                  <div
                    className="size-16"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="font-display text-lg uppercase leading-tight">
                      <span className="text-primary">{i + 1}. </span>
                      {name}
                    </h3>
                    <span className="font-display text-base text-recovery">
                      {work}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {block.mode === "time" && (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="size-3.5" />
                        {block.sets} {block.sets === 1 ? "set" : "sets"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3.5" />
                      {block.restSec}s rest
                    </span>
                  </div>
                  {tip && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        Tip:{" "}
                      </span>
                      {tip}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          {template.blocks.length === 0 && (
            <div className="surface border-dashed p-8 text-center text-muted-foreground">
              This workout has no exercises yet.
            </div>
          )}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2.5">
          <span className="accent-bar !h-4 !w-1" />
          <h2 className="eyebrow">Intensity</h2>
        </div>
        <p className="mb-4 mt-1.5 text-sm text-muted-foreground">
          Scale the workout to match how you feel today.
        </p>
        <Tabs
          value={scaling}
          onValueChange={(v) => setScaling(v as ScalingOption)}
        >
          <TabsList className="grid w-full grid-cols-3 sm:max-w-md">
            <TabsTrigger value="easier">Easier</TabsTrigger>
            <TabsTrigger value="standard">Standard</TabsTrigger>
            <TabsTrigger value="harder">Harder</TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => app.startWorkout(template.id, scaling)}
          className="glow-cta flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[var(--radius)] bg-primary px-8 font-display text-lg uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
        >
          <Play className="size-5 fill-current" />
          Start workout
        </button>
        <button
          onClick={() =>
            app.openBuilder(
              template.id,
              template.isCustom ? "edit" : "duplicate",
            )
          }
          className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest transition-colors hover:border-primary/40"
        >
          <Pencil className="size-4" />
          Edit workout
        </button>
        <button
          onClick={() => app.openBuilder(template.id, "duplicate")}
          className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest transition-colors hover:border-primary/40"
        >
          <Copy className="size-4" />
          Duplicate
        </button>
      </section>
    </div>
  )
}
