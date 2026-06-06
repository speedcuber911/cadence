import { ArrowUpRight, Clock, Flame, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Difficulty, WorkoutTemplate } from "@/types"

const GOAL_LABEL: Record<WorkoutTemplate["goal"], string> = {
  fat_loss: "Fat Loss",
  strength: "Strength",
  general_fitness: "General",
  mobility: "Mobility",
  recovery: "Recovery",
}

const DIFFICULTY_BAR: Record<Difficulty, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
}

function muscleLabel(m: string): string {
  return m.replace(/_/g, " ")
}

/** Athletic workout card: heavy condensed title, orange action, diagonal sheen. */
export function WorkoutCard({
  template,
  onStart,
  onPreview,
}: {
  template: WorkoutTemplate
  onStart: () => void
  onPreview: () => void
}) {
  const muscles = template.muscleGroups.slice(0, 3)
  const level = DIFFICULTY_BAR[template.difficulty]

  return (
    <div className="group surface relative flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      {/* corner accent */}
      <div className="pointer-events-none absolute right-0 top-0 size-24 translate-x-8 -translate-y-8 rounded-full bg-primary/20 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-0" />

      {/* preview tap zone */}
      <button
        onClick={onPreview}
        className="flex flex-1 flex-col gap-4 p-5 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-primary">{GOAL_LABEL[template.goal]}</span>
            {template.isCustom && (
              <span className="eyebrow rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                Custom
              </span>
            )}
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>

        <h3 className="font-display text-2xl uppercase leading-[0.95] tracking-tight">
          {template.name}
        </h3>

        <div className="mt-auto flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" />
            {template.estimatedMinutes}m
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Flame className="size-4" />
            {template.estimatedCalories[0]}–{template.estimatedCalories[1]}
          </span>
          {/* difficulty meter */}
          <span className="ml-auto inline-flex items-center gap-1" title={template.difficulty}>
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-3.5 w-1 rounded-full",
                  i <= level ? "bg-primary" : "bg-secondary",
                )}
              />
            ))}
          </span>
        </div>

        {muscles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {muscles.map((m) => (
              <span
                key={m}
                className="rounded bg-secondary/70 px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground"
              >
                {muscleLabel(m)}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* start strip */}
      <button
        onClick={onStart}
        className="glow-cta flex items-center justify-center gap-2 bg-primary py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
      >
        <Play className="size-4 fill-current" />
        Start
      </button>
    </div>
  )
}
