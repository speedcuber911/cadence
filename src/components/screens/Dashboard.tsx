import {
  Activity,
  ArrowRight,
  Clock,
  Dumbbell,
  Eye,
  Flame,
  Hammer,
  ListChecks,
  Play,
  Sparkles,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDateShort, formatMinutes, isoDate } from "@/lib/format"
import { recommendWorkout } from "@/lib/recommend"
import { cn } from "@/lib/utils"
import type { AppApi } from "@/lib/appState"
import type {
  FeelRating,
  Goal,
  MuscleGroup,
  TimeAvailable,
  WorkoutSession,
} from "@/types"

// ---------------------------------------------------------------------------
// Static label maps
// ---------------------------------------------------------------------------

const GOAL_LABEL: Record<Goal, string> = {
  fat_loss: "Fat loss",
  strength: "Strength",
  general_fitness: "General fitness",
  mobility: "Mobility",
  recovery: "Recovery",
}

const GOAL_ORDER: Goal[] = [
  "general_fitness",
  "fat_loss",
  "strength",
  "mobility",
  "recovery",
]

const TIME_OPTIONS: TimeAvailable[] = [10, 15, 20, 30, 45]

const FEEL_LABEL: Record<FeelRating, string> = {
  easy: "Felt easy",
  good: "Felt good",
  hard: "Felt hard",
  brutal: "Felt brutal",
}

const FEEL_STYLE: Record<FeelRating, string> = {
  easy: "text-work border-work/40 bg-work/10",
  good: "text-work border-work/40 bg-work/10",
  hard: "text-rest border-rest/40 bg-rest/10",
  brutal: "text-destructive border-destructive/40 bg-destructive/10",
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function muscleLabel(m: MuscleGroup): string {
  return m.replace(/_/g, " ")
}

// ---------------------------------------------------------------------------
// Weekly / streak computations
// ---------------------------------------------------------------------------

interface WeeklyStats {
  count: number
  minutes: number
  calories: number
  streak: number
  recentSessions: WorkoutSession[]
}

/** Sessions completed within the trailing 7 days. */
function computeWeekly(history: WorkoutSession[], now: Date): WeeklyStats {
  const nowMs = now.getTime()
  const recentSessions = history.filter((s) => {
    const ts = new Date(s.completedAt).getTime()
    if (Number.isNaN(ts)) return false
    return nowMs - ts <= 7 * MS_PER_DAY && ts <= nowMs
  })

  let minutes = 0
  let calories = 0
  for (const s of recentSessions) {
    minutes += Math.round((s.durationSec || 0) / 60)
    calories += Math.round(s.estimatedCalories || 0)
  }

  return {
    count: recentSessions.length,
    minutes,
    calories,
    streak: computeStreak(history, now),
    recentSessions,
  }
}

/**
 * Consecutive distinct calendar days with at least one workout, ending today
 * or yesterday (a missed today doesn't break a streak until tomorrow).
 */
function computeStreak(history: WorkoutSession[], now: Date): number {
  if (history.length === 0) return 0

  const days = new Set<string>()
  for (const s of history) {
    const d = new Date(s.completedAt)
    if (!Number.isNaN(d.getTime())) days.add(isoDate(d))
  }

  const today = isoDate(now)
  const yesterday = isoDate(new Date(now.getTime() - MS_PER_DAY))
  if (!days.has(today) && !days.has(yesterday)) return 0

  // Walk back day-by-day from the anchor (today if present, else yesterday).
  let cursor = new Date(now)
  if (!days.has(today)) cursor = new Date(now.getTime() - MS_PER_DAY)

  let streak = 0
  while (days.has(isoDate(cursor))) {
    streak++
    cursor = new Date(cursor.getTime() - MS_PER_DAY)
  }
  return streak
}

/** Muscle groups from the last-7-days sessions, most frequent first. */
function computeRecentMuscles(
  recentSessions: WorkoutSession[],
): { muscle: MuscleGroup; count: number }[] {
  const counts = new Map<MuscleGroup, number>()
  for (const s of recentSessions) {
    for (const m of s.muscleGroups) {
      counts.set(m, (counts.get(m) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([muscle, count]) => ({ muscle, count }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Local subcomponents
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="accent-bar !h-4 !w-1" />
      <h2 className="eyebrow">{children}</h2>
    </div>
  )
}

function StatTile({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: React.ReactNode
  label: string
  accent: string
}) {
  return (
    <div className="surface relative overflow-hidden p-4">
      <Icon className={cn("absolute -right-2 -top-2 size-12 opacity-10", accent)} />
      <div className="font-display text-5xl leading-none tabular-nums">{value}</div>
      <div className="mt-2 eyebrow">{label}</div>
    </div>
  )
}

function QuickTile({
  icon: Icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-start gap-6 rounded-[var(--radius)] border p-4 text-left transition-all",
        "disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "border-transparent bg-primary text-primary-foreground glow-cta hover:brightness-110"
          : "surface hover:border-primary/40 hover:-translate-y-0.5",
      )}
    >
      <Icon className="size-5" strokeWidth={2.5} />
      <span className="font-display text-sm uppercase tracking-wide">{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function Dashboard({ app }: { app: AppApi }) {
  const now = new Date()

  const rec = recommendWorkout({
    templates: app.templates,
    history: app.history,
    goal: app.lastGoal,
    timeAvailable: app.timeAvailable,
    now,
  })
  const suggested = rec.templateId ? app.getTemplate(rec.templateId) : undefined

  const weekly = computeWeekly(app.history, now)
  const recentMuscles = computeRecentMuscles(weekly.recentSessions)
  const lastSession = app.history[0]

  const greetingName = app.settings.name?.trim()

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Greeting header */}
      <header className="flex flex-col gap-6">
        <div>
          <p className="eyebrow text-primary">Good to see you</p>
          <h1 className="mt-2 font-display text-6xl uppercase leading-[0.85] sm:text-7xl">
            {greetingName ? (
              <>
                Let&apos;s go,
                <br />
                <span className="text-primary">{greetingName}</span>
              </>
            ) : (
              <>
                Ready to
                <br />
                <span className="text-primary">train?</span>
              </>
            )}
          </h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label className="eyebrow">Goal</label>
            <Select
              value={app.lastGoal}
              onValueChange={(v) => app.setLastGoal(v as Goal)}
            >
              <SelectTrigger className="surface bg-card font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_ORDER.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GOAL_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="eyebrow">Time available</label>
            <Select
              value={String(app.timeAvailable)}
              onValueChange={(v) =>
                app.setTimeAvailable(Number(v) as TimeAvailable)
              }
            >
              <SelectTrigger className="surface bg-card font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Today's suggested workout (hero) */}
      <section className="mt-10 space-y-4">
        <SectionTitle>Today&apos;s suggested workout</SectionTitle>
        {suggested ? (
          <div className="surface relative overflow-hidden border-primary/30">
            {/* diagonal energy field */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(115deg, hsl(var(--brand)) 0 2px, transparent 2px 22px)",
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/25 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 font-display text-xs uppercase tracking-widest text-primary-foreground">
                  <Sparkles className="size-3.5" />
                  {rec.tag}
                </span>
                <span className="eyebrow">Suggested for you</span>
              </div>

              <h3 className="font-display text-4xl uppercase leading-[0.9] sm:text-5xl">
                {suggested.name}
              </h3>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-display text-lg">
                <span className="inline-flex items-baseline gap-1.5">
                  <Clock className="size-4 translate-y-0.5 text-primary" />
                  {suggested.estimatedMinutes}
                  <span className="text-sm text-muted-foreground">MIN</span>
                </span>
                <span className="inline-flex items-baseline gap-1.5">
                  <Flame className="size-4 translate-y-0.5 text-primary" />
                  {suggested.estimatedCalories[0]}–{suggested.estimatedCalories[1]}
                  <span className="text-sm text-muted-foreground">KCAL</span>
                </span>
                <span className="inline-flex items-baseline gap-1.5">
                  <Activity className="size-4 translate-y-0.5 text-primary" />
                  <span className="uppercase">{GOAL_LABEL[suggested.goal]}</span>
                </span>
              </div>

              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {rec.reason}
              </p>

              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => app.startWorkout(suggested.id)}
                  className="glow-cta flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[var(--radius)] bg-primary font-display text-lg uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
                >
                  <Play className="size-5 fill-current" />
                  Start workout
                </button>
                <button
                  onClick={() => app.openDetail(suggested.id)}
                  className="flex h-14 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest transition-colors hover:border-primary/40 sm:w-44"
                >
                  <Eye className="size-4" />
                  Preview
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="surface p-8 text-center">
            <Dumbbell className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-display text-xl uppercase">No workouts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">{rec.reason}</p>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-5 py-2.5 font-display text-sm uppercase tracking-widest text-primary-foreground glow-cta"
              onClick={() => app.navigate("library")}
            >
              Browse the Library
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-10 space-y-4">
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickTile
            icon={Play}
            label="Start suggested"
            primary
            disabled={!suggested}
            onClick={() => suggested && app.startWorkout(suggested.id)}
          />
          <QuickTile
            icon={Dumbbell}
            label="Choose workout"
            onClick={() => app.navigate("library")}
          />
          <QuickTile
            icon={Hammer}
            label="Build custom"
            onClick={() => app.openBuilder(undefined, "new")}
          />
          <QuickTile
            icon={ListChecks}
            label="Log completed"
            onClick={() => app.navigate("history")}
          />
        </div>
      </section>

      {/* Weekly activity summary */}
      <section className="mt-10 space-y-4">
        <SectionTitle>This week</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            icon={Dumbbell}
            value={weekly.count}
            label="Workouts"
            accent="text-primary"
          />
          <StatTile
            icon={Clock}
            value={weekly.minutes}
            label="Active min"
            accent="text-recovery"
          />
          <StatTile
            icon={Flame}
            value={weekly.calories}
            label="Est. calories"
            accent="text-rest"
          />
          <StatTile
            icon={Zap}
            value={weekly.streak}
            label="Day streak"
            accent="text-primary"
          />
        </div>
      </section>

      {/* Last workout summary */}
      <section className="mt-10 space-y-4">
        <SectionTitle>Last workout</SectionTitle>
        {lastSession ? (
          <button
            type="button"
            onClick={() => app.navigate("history")}
            className="w-full text-left"
          >
            <div className="surface flex items-center gap-4 p-5 transition-colors hover:border-primary/40">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/15 text-primary">
                <Dumbbell className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-display text-lg uppercase">
                    {lastSession.templateName}
                  </h3>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {formatDateShort(lastSession.completedAt)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {formatMinutes(lastSession.durationSec)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Flame className="size-3.5" />
                    {Math.round(lastSession.estimatedCalories)} kcal
                  </span>
                  {typeof lastSession.rpe === "number" && (
                    <span className="inline-flex items-center gap-1">
                      <Activity className="size-3.5" />
                      RPE {lastSession.rpe}
                    </span>
                  )}
                  {lastSession.feel && (
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        FEEL_STYLE[lastSession.feel],
                      )}
                    >
                      {FEEL_LABEL[lastSession.feel]}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        ) : (
          <div className="surface p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No workouts yet — start your first!
            </p>
          </div>
        )}
      </section>

      {/* Muscle groups trained recently */}
      <section className="mt-10 space-y-4">
        <SectionTitle>Muscle groups trained recently</SectionTitle>
        {recentMuscles.length > 0 ? (
          <div className="surface p-5">
            <div className="flex flex-wrap gap-2">
              {recentMuscles.map(({ muscle, count }) => (
                <span
                  key={muscle}
                  className="inline-flex items-center gap-1.5 rounded bg-secondary px-3 py-1.5 text-sm font-semibold uppercase tracking-wide"
                >
                  {muscleLabel(muscle)}
                  <span className="rounded bg-primary/20 px-1.5 text-xs tabular-nums text-primary">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="surface p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No muscle groups trained in the last 7 days.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
