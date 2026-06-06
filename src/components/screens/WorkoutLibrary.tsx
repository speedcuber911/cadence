import { useMemo, useState } from "react"
import { Dumbbell, Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WorkoutCard } from "@/components/workout/WorkoutCard"
import type { AppApi } from "@/lib/appState"
import type { Difficulty, Goal, WorkoutTemplate } from "@/types"

type GoalFilter = "all" | Goal
type DifficultyFilter = "all" | Difficulty

interface Section {
  key: string
  title: string
  subtitle: string
  templates: WorkoutTemplate[]
}

function matches(
  t: WorkoutTemplate,
  goal: GoalFilter,
  difficulty: DifficultyFilter,
  query: string,
): boolean {
  if (difficulty !== "all" && t.difficulty !== difficulty) return false
  if (goal !== "all") {
    if (goal === "mobility") {
      if (t.goal !== "mobility" && t.goal !== "recovery") return false
    } else if (t.goal !== goal) {
      return false
    }
  }
  const q = query.trim().toLowerCase()
  if (q && !t.name.toLowerCase().includes(q)) return false
  return true
}

export default function WorkoutLibrary({ app }: { app: AppApi }) {
  const [goal, setGoal] = useState<GoalFilter>("all")
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all")
  const [query, setQuery] = useState("")

  const sections = useMemo<Section[]>(() => {
    const visible = app.templates.filter((t) =>
      matches(t, goal, difficulty, query),
    )

    const fatLoss = visible.filter((t) => !t.isCustom && t.goal === "fat_loss")
    const strength = visible.filter((t) => !t.isCustom && t.goal === "strength")
    const mobility = visible.filter(
      (t) => !t.isCustom && (t.goal === "mobility" || t.goal === "recovery"),
    )
    const general = visible.filter(
      (t) => !t.isCustom && t.goal === "general_fitness",
    )
    const custom = visible.filter((t) => t.isCustom)

    return [
      {
        key: "fat_loss",
        title: "Fat Loss / Conditioning",
        subtitle: "High-output sessions to burn and condition.",
        templates: fatLoss,
      },
      {
        key: "strength",
        title: "Strength",
        subtitle: "Build power and muscle with focused work.",
        templates: strength,
      },
      {
        key: "mobility",
        title: "Mobility / Recovery",
        subtitle: "Restore range of motion and recover well.",
        templates: mobility,
      },
      {
        key: "general",
        title: "General Fitness",
        subtitle: "Balanced full-body sessions.",
        templates: general,
      },
      {
        key: "custom",
        title: "Custom",
        subtitle: "Workouts you've built and saved.",
        templates: custom,
      },
    ]
  }, [app.templates, goal, difficulty, query])

  const customSection = sections.find((s) => s.key === "custom")!
  const standardSections = sections.filter((s) => s.key !== "custom")

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="eyebrow text-primary">Pick your session</p>
        <h1 className="mt-2 font-display text-6xl uppercase leading-[0.85] sm:text-7xl">
          Workout
          <br />
          <span className="text-primary">Library</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Browse curated sessions or build your own. Filter by goal, difficulty,
          or search by name.
        </p>
      </header>

      <div className="surface mb-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workouts..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-3">
          <Select
            value={goal}
            onValueChange={(v) => setGoal(v as GoalFilter)}
          >
            <SelectTrigger className="surface w-[150px] bg-card font-semibold">
              <SelectValue placeholder="Goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All goals</SelectItem>
              <SelectItem value="fat_loss">Fat loss</SelectItem>
              <SelectItem value="strength">Strength</SelectItem>
              <SelectItem value="mobility">Mobility</SelectItem>
              <SelectItem value="recovery">Recovery</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={difficulty}
            onValueChange={(v) => setDifficulty(v as DifficultyFilter)}
          >
            <SelectTrigger className="surface w-[150px] bg-card font-semibold">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-12">
        {standardSections.map((section) =>
          section.templates.length > 0 ? (
            <section key={section.key}>
              <div className="mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="accent-bar !h-4 !w-1" />
                  <h2 className="font-display text-2xl uppercase leading-none tracking-tight">
                    {section.title}
                  </h2>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {section.subtitle}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {section.templates.map((t) => (
                  <WorkoutCard
                    key={t.id}
                    template={t}
                    onStart={() => app.startWorkout(t.id)}
                    onPreview={() => app.openDetail(t.id)}
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="accent-bar !h-4 !w-1" />
                <h2 className="font-display text-2xl uppercase leading-none tracking-tight">
                  {customSection.title}
                </h2>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {customSection.subtitle}
              </p>
            </div>
            <button
              onClick={() => app.openBuilder(undefined, "new")}
              className="flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest transition-colors hover:border-primary/40"
            >
              <Plus className="size-4" />
              New workout
            </button>
          </div>

          {customSection.templates.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {customSection.templates.map((t) => (
                <WorkoutCard
                  key={t.id}
                  template={t}
                  onStart={() => app.startWorkout(t.id)}
                  onPreview={() => app.openDetail(t.id)}
                />
              ))}
            </div>
          ) : (
            <div className="surface flex flex-col items-center justify-center gap-4 border-dashed px-6 py-14 text-center">
              <div className="flex size-14 items-center justify-center rounded-[var(--radius)] bg-primary/15 text-primary">
                <Dumbbell className="size-7" />
              </div>
              <div>
                <h3 className="font-display text-xl uppercase">
                  No custom workouts yet
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Design a session around your goals, equipment, and time.
                </p>
              </div>
              <button
                onClick={() => app.openBuilder(undefined, "new")}
                className="glow-cta flex h-12 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-6 font-display text-sm uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
              >
                <Plus className="size-4" />
                Build a custom workout
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
