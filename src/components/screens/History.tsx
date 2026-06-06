import { useMemo, useState } from "react"
import {
  Activity,
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  Flame,
  Heart,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getExercise } from "@/data/exercises"
import type { AppApi } from "@/lib/appState"
import {
  daysBetween,
  formatDateShort,
  formatMinutes,
  isoDate,
} from "@/lib/format"
import type {
  Difficulty,
  ExerciseLog,
  FeelRating,
  Goal,
  MuscleGroup,
  WorkoutSession,
} from "@/types"

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const GOAL_LABELS: Record<Goal, string> = {
  fat_loss: "Fat loss",
  strength: "Strength",
  general_fitness: "General fitness",
  mobility: "Mobility",
  recovery: "Recovery",
}

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  triceps: "Triceps",
  biceps: "Biceps",
  back: "Back",
  core: "Core",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  hip_flexors: "Hip flexors",
  full_body: "Full body",
  cardio: "Cardio",
}

const FEEL_META: Record<
  FeelRating,
  { label: string; className: string }
> = {
  easy: {
    label: "Easy",
    className: "border-recovery/40 bg-recovery/15 text-recovery",
  },
  good: {
    label: "Good",
    className: "border-work/40 bg-work/15 text-work",
  },
  hard: {
    label: "Hard",
    className: "border-rest/40 bg-rest/15 text-rest",
  },
  brutal: {
    label: "Brutal",
    className: "border-destructive/40 bg-destructive/15 text-destructive",
  },
}

type TimeRange = "7" | "30" | "all"
type GoalFilter = "all" | Goal
type MuscleFilter = "all" | MuscleGroup
type DifficultyFilter = "all" | Difficulty

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function feelBadge(feel?: FeelRating) {
  if (!feel) return null
  const meta = FEEL_META[feel]
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

function setResultText(log: ExerciseLog): string {
  const base =
    log.mode === "time"
      ? `${log.durationSec ?? 0}s`
      : `${log.repsCompleted ?? 0} reps`
  return log.weight ? `${base} @ ${log.weight}` : base
}

interface GroupedLog {
  exerciseId: string
  name: string
  sets: ExerciseLog[]
}

function groupLogs(logs: ExerciseLog[]): GroupedLog[] {
  const order: string[] = []
  const map = new Map<string, GroupedLog>()
  for (const log of logs) {
    let group = map.get(log.exerciseId)
    if (!group) {
      group = {
        exerciseId: log.exerciseId,
        name: getExercise(log.exerciseId)?.name ?? log.exerciseName,
        sets: [],
      }
      map.set(log.exerciseId, group)
      order.push(log.exerciseId)
    }
    group.sets.push(log)
  }
  for (const id of order) {
    map.get(id)!.sets.sort((a, b) => a.setIndex - b.setIndex)
  }
  return order.map((id) => map.get(id)!)
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Stat chip
// ---------------------------------------------------------------------------

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="text-muted-foreground/80">{icon}</span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail dialog
// ---------------------------------------------------------------------------

function SessionDetail({
  session,
  onDelete,
  onClose,
}: {
  session: WorkoutSession
  onDelete: () => void
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const groups = useMemo(() => groupLogs(session.logs), [session.logs])
  const watch = session.watch

  return (
    <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-2xl">
      <DialogHeader className="text-left">
        <DialogTitle className="font-display text-3xl uppercase leading-[0.9]">
          {session.templateName}
        </DialogTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          <span>{formatDateTime(session.completedAt)}</span>
          {feelBadge(session.feel)}
        </div>
      </DialogHeader>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface p-3">
          <div className="flex items-center gap-1.5 eyebrow">
            <Clock className="size-3.5" /> Duration
          </div>
          <div className="mt-1 font-display text-2xl tabular-nums">
            {formatMinutes(session.durationSec)}
          </div>
        </div>
        <div className="surface p-3">
          <div className="flex items-center gap-1.5 eyebrow">
            <Flame className="size-3.5" /> Calories
          </div>
          <div className="mt-1 font-display text-2xl tabular-nums">
            {session.estimatedCalories}
          </div>
        </div>
        <div className="surface p-3">
          <div className="flex items-center gap-1.5 eyebrow">
            <Activity className="size-3.5" /> RPE
          </div>
          <div className="mt-1 font-display text-2xl tabular-nums">
            {session.rpe ?? "—"}
          </div>
        </div>
        <div className="surface p-3">
          <div className="flex items-center gap-1.5 eyebrow">
            <Heart className="size-3.5" /> Avg HR
          </div>
          <div className="mt-1 font-display text-2xl tabular-nums">
            {watch?.avgHr ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary">{GOAL_LABELS[session.goal]}</Badge>
        <Badge variant="outline">{session.difficulty}</Badge>
        <Badge variant="outline">
          {session.exercisesCompleted}/{session.exercisesTotal} exercises
        </Badge>
        <Badge variant="outline">{session.setsCompleted} sets</Badge>
      </div>

      {watch && (watch.avgHr || watch.totalKcal || watch.activeKcal) ? (
        <div className="mt-4 rounded-[var(--radius)] border border-recovery/30 bg-recovery/5 p-3">
          <div className="mb-2 flex items-center gap-1.5 eyebrow text-recovery">
            <Heart className="size-4" /> Watch stats
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Avg HR</div>
              <div className="font-semibold tabular-nums">
                {watch.avgHr ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total kcal</div>
              <div className="font-semibold tabular-nums">
                {watch.totalKcal ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Active kcal</div>
              <div className="font-semibold tabular-nums">
                {watch.activeKcal ?? "—"}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {session.notes ? (
        <div className="surface mt-4 p-3">
          <div className="eyebrow">
            Notes
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
            {session.notes}
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="accent-bar !h-4 !w-1" />
          <h3 className="eyebrow">Exercise log</h3>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sets logged.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.exerciseId}
                className="surface p-3"
              >
                <div className="font-display text-lg uppercase">{group.name}</div>
                <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {group.sets.map((set) => (
                    <li
                      key={set.setIndex}
                      className={`flex items-center justify-between rounded-md px-2 py-1 text-sm ${
                        set.completed
                          ? "bg-secondary/40"
                          : "bg-transparent text-muted-foreground line-through"
                      }`}
                    >
                      <span className="text-muted-foreground">
                        Set {set.setIndex + 1}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {setResultText(set)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
        {confirming ? (
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Delete this session permanently?
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => {
                  onDelete()
                  onClose()
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" /> Delete session
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </>
        )}
      </div>
    </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function History({ app }: { app: AppApi }) {
  const [range, setRange] = useState<TimeRange>("all")
  const [goal, setGoal] = useState<GoalFilter>("all")
  const [muscle, setMuscle] = useState<MuscleFilter>("all")
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all")
  const [openId, setOpenId] = useState<string | null>(null)

  const sorted = useMemo(
    () =>
      [...app.history].sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      ),
    [app.history],
  )

  // Muscle groups present across all history (for the muscle filter options).
  const muscleOptions = useMemo(() => {
    const present = new Set<MuscleGroup>()
    for (const s of sorted) {
      for (const m of s.muscleGroups) present.add(m)
    }
    return Array.from(present).sort((a, b) =>
      MUSCLE_LABELS[a].localeCompare(MUSCLE_LABELS[b]),
    )
  }, [sorted])

  const filtered = useMemo(() => {
    const today = isoDate()
    return sorted.filter((s) => {
      if (range !== "all") {
        const limit = range === "7" ? 7 : 30
        if (daysBetween(s.date, today) > limit) return false
      }
      if (goal !== "all" && s.goal !== goal) return false
      if (difficulty !== "all" && s.difficulty !== difficulty) return false
      if (muscle !== "all" && !s.muscleGroups.includes(muscle)) return false
      return true
    })
  }, [sorted, range, goal, muscle, difficulty])

  const openSession = openId
    ? sorted.find((s) => s.id === openId) ?? null
    : null

  // ---- Empty state: no history at all ----
  if (sorted.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="eyebrow text-primary">Your training log</p>
          <h1 className="mt-2 font-display text-6xl uppercase leading-[0.85] sm:text-7xl">
            History
          </h1>
        </header>
        <div className="surface flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-[var(--radius)] bg-primary/15 text-primary">
            <Calendar className="size-7" />
          </div>
          <div>
            <h3 className="font-display text-2xl uppercase">No workouts logged yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Finish a session and it will show up here with your stats and
              full exercise breakdown.
            </p>
          </div>
          <Button onClick={() => app.navigate("dashboard")}>
            Start a workout
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="eyebrow text-primary">Your training log</p>
        <h1 className="mt-2 font-display text-6xl uppercase leading-[0.85] sm:text-7xl">
          History
        </h1>
        <p className="mt-2 text-muted-foreground">
          {sorted.length} session{sorted.length === 1 ? "" : "s"} logged
          {filtered.length !== sorted.length
            ? ` · ${filtered.length} shown`
            : ""}
        </p>
      </header>

      {/* Filter bar */}
      <div className="surface mb-8 flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <TabsList>
            <TabsTrigger value="7">Last 7 days</TabsTrigger>
            <TabsTrigger value="30">Last 30 days</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <Filter className="hidden size-4 text-muted-foreground sm:block" />
          <Select value={goal} onValueChange={(v) => setGoal(v as GoalFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All goals</SelectItem>
              {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                <SelectItem key={g} value={g}>
                  {GOAL_LABELS[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={muscle}
            onValueChange={(v) => setMuscle(v as MuscleFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Muscle group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All muscles</SelectItem>
              {muscleOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {MUSCLE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={difficulty}
            onValueChange={(v) => setDifficulty(v as DifficultyFilter)}
          >
            <SelectTrigger className="w-[150px]">
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <Filter className="size-7 text-muted-foreground" />
          <h3 className="font-display text-2xl uppercase">
            No workouts match these filters
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try widening the time range or clearing a filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setOpenId(s.id)
                }
              }}
              className="surface group cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-4">
                <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-[var(--radius)] border border-border bg-primary/10 py-2 text-center">
                  <span className="eyebrow text-primary">
                    {formatDateShort(s.date).split(" ")[0]}
                  </span>
                  <span className="font-display text-2xl leading-none tabular-nums">
                    {formatDateShort(s.date).split(" ")[1]}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-lg uppercase">
                      {s.templateName}
                    </h3>
                    {feelBadge(s.feel)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <Stat
                      icon={<Clock className="size-4" />}
                      value={formatMinutes(s.durationSec)}
                      label=""
                    />
                    <Stat
                      icon={<Flame className="size-4" />}
                      value={s.estimatedCalories}
                      label="kcal"
                    />
                    <Stat
                      icon={<Heart className="size-4" />}
                      value={s.watch?.avgHr ?? "—"}
                      label="bpm"
                    />
                    <Stat
                      icon={<Activity className="size-4" />}
                      value={`RPE ${s.rpe ?? "—"}`}
                      label=""
                    />
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">
                        {s.exercisesCompleted}/{s.exercisesTotal}
                      </span>{" "}
                      exercises
                    </span>
                  </div>
                </div>

                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={openSession !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
      >
        {openSession ? (
          <SessionDetail
            session={openSession}
            onDelete={() => app.deleteSession(openSession.id)}
            onClose={() => setOpenId(null)}
          />
        ) : null}
      </Dialog>
    </div>
  )
}
