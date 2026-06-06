import { useMemo } from "react"
import {
  Activity,
  BarChart3,
  CalendarDays,
  Dumbbell,
  Flame,
  Gauge,
  HeartPulse,
  Layers,
  TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { getExercise } from "@/data/exercises"
import { formatDateShort, isoDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AppApi } from "@/lib/appState"
import type { MuscleGroup, WorkoutSession } from "@/types"

// ===========================================================================
// Progress Dashboard — all metrics derived from app.history.
// Lightweight custom charts (inline SVG + CSS bars), no chart library.
// ===========================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000

const MUSCLE_LABEL: Record<MuscleGroup, string> = {
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

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Local midnight Date for an ISO date/timestamp. */
function dayStart(iso: string): Date {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Monday-anchored week start for a date. */
function weekStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // 0 = Monday
  x.setDate(x.getDate() - dow)
  return x
}

// ---------------------------------------------------------------------------
// Tiny chart primitives
// ---------------------------------------------------------------------------

interface BarDatum {
  label: string
  value: number
}

function BarChart({
  data,
  colorVar = "--brand",
  format = (v: number) => String(v),
}: {
  data: BarDatum[]
  colorVar?: string
  format?: (v: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div className="group relative w-full">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%`,
                    minHeight: d.value > 0 ? 3 : 0,
                    background: `hsl(var(${colorVar}))`,
                    opacity: 0.55 + (pct / 100) * 0.45,
                  }}
                />
                <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] tabular-nums text-foreground shadow group-hover:block">
                  {format(d.value)}
                </span>
              </div>
            </div>
            <span className="text-[10px] leading-none text-muted-foreground">
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Sparkline({
  values,
  colorVar = "--brand",
  height = 56,
}: {
  values: number[]
  colorVar?: string
  height?: number
}) {
  const width = 240
  const pad = 4
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX =
    values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(" ")
  const area = `${pad},${height - pad} ${line} ${points[points.length - 1][0]},${
    height - pad
  }`
  const stroke = `hsl(var(${colorVar}))`
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
    >
      <polygon points={area} fill={stroke} opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} fill={stroke} />
      ))}
    </svg>
  )
}

function HBar({
  label,
  value,
  max,
  colorVar = "--brand",
  suffix,
}: {
  label: string
  value: number
  max: number
  colorVar?: string
  suffix?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-muted/40">
        <div
          className="h-full rounded-sm"
          style={{
            width: `${Math.max(pct, value > 0 ? 6 : 0)}%`,
            background: `hsl(var(${colorVar}))`,
            opacity: 0.9,
          }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-display text-sm tabular-nums text-foreground">
        {value}
        {suffix ?? ""}
      </span>
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-[var(--radius)] border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function Panel({
  icon: Icon,
  iconClass,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon
  iconClass: string
  title: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("surface flex flex-col p-5", className)}>
      <div className="flex items-center gap-2.5">
        <span className="accent-bar !h-4 !w-1" />
        <h2 className="eyebrow">{title}</h2>
      </div>
      <div className="mt-2 flex items-center gap-1.5 font-display text-lg uppercase leading-none">
        <Icon className={cn("h-4 w-4", iconClass)} />
        {description}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

interface Metrics {
  currentStreak: number
  longestStreak: number
  recentDays: { date: Date; active: boolean }[]
  weeks: {
    label: string
    workouts: number
    minutes: number
    calories: number
  }[]
  hrSeries: number[]
  rpeSeries: number[]
  muscleFreq: BarDatum[]
  topExercises: BarDatum[]
  totals: { pushups: number; squats: number; lunges: number }
}

function computeMetrics(history: WorkoutSession[]): Metrics {
  // Distinct workout days (local).
  const dayKeys = new Set(history.map((s) => isoDate(dayStart(s.date))))

  // --- Streaks ---
  const today = dayStart(isoDate())
  const yesterday = new Date(today.getTime() - MS_PER_DAY)
  let currentStreak = 0
  if (dayKeys.has(isoDate(today)) || dayKeys.has(isoDate(yesterday))) {
    let cursor = dayKeys.has(isoDate(today)) ? today : yesterday
    while (dayKeys.has(isoDate(cursor))) {
      currentStreak++
      cursor = new Date(cursor.getTime() - MS_PER_DAY)
    }
  }

  // Longest streak across all active days.
  const sortedDays = [...dayKeys]
    .map((k) => dayStart(k).getTime())
    .sort((a, b) => a - b)
  let longestStreak = 0
  let run = 0
  let prev = NaN
  for (const t of sortedDays) {
    if (!Number.isNaN(prev) && t - prev === MS_PER_DAY) run++
    else run = 1
    longestStreak = Math.max(longestStreak, run)
    prev = t
  }

  // --- Recent-day dots (last 14 days) ---
  const recentDays: { date: Date; active: boolean }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * MS_PER_DAY)
    recentDays.push({ date: d, active: dayKeys.has(isoDate(d)) })
  }

  // --- Weekly aggregates (last 8 weeks) ---
  const thisWeek = weekStart(today)
  const weeks: Metrics["weeks"] = []
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(thisWeek.getTime() - i * 7 * MS_PER_DAY)
    weeks.push({
      label: formatDateShort(isoDate(ws)),
      workouts: 0,
      minutes: 0,
      calories: 0,
    })
  }
  const firstWeekTime = weeks.length
    ? dayStart(
        isoDate(new Date(thisWeek.getTime() - 7 * 7 * MS_PER_DAY)),
      ).getTime()
    : 0
  for (const s of history) {
    const wt = weekStart(dayStart(s.date)).getTime()
    if (wt < firstWeekTime || wt > thisWeek.getTime()) continue
    const idx = Math.round((wt - firstWeekTime) / (7 * MS_PER_DAY))
    if (idx < 0 || idx >= weeks.length) continue
    weeks[idx].workouts += 1
    weeks[idx].minutes += Math.round(s.durationSec / 60)
    weeks[idx].calories += Math.round(s.estimatedCalories)
  }

  // --- Trend series (chronological) ---
  const chrono = [...history].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  )
  const RECENT = 20
  const hrSeries = chrono
    .filter((s) => typeof s.watch?.avgHr === "number" && s.watch.avgHr! > 0)
    .map((s) => s.watch!.avgHr!)
    .slice(-RECENT)
  const rpeSeries = chrono
    .filter((s) => typeof s.rpe === "number" && s.rpe! > 0)
    .map((s) => s.rpe!)
    .slice(-RECENT)

  // --- Muscle group frequency (sessions per group, all history) ---
  const muscleCounts = new Map<MuscleGroup, number>()
  for (const s of history) {
    for (const m of s.muscleGroups) {
      muscleCounts.set(m, (muscleCounts.get(m) ?? 0) + 1)
    }
  }
  const muscleFreq: BarDatum[] = [...muscleCounts.entries()]
    .map(([m, v]) => ({ label: MUSCLE_LABEL[m] ?? m, value: v }))
    .sort((a, b) => b.value - a.value)

  // --- Most trained exercises (by log occurrence) ---
  const exCounts = new Map<string, number>()
  for (const s of history) {
    for (const log of s.logs) {
      exCounts.set(log.exerciseId, (exCounts.get(log.exerciseId) ?? 0) + 1)
    }
  }
  const topExercises: BarDatum[] = [...exCounts.entries()]
    .map(([id, v]) => ({
      label: getExercise(id)?.name ?? id,
      value: v,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // --- Totals over time (rep-mode logs by movement name) ---
  const totals = { pushups: 0, squats: 0, lunges: 0 }
  for (const s of history) {
    for (const log of s.logs) {
      if (log.mode !== "reps" || !log.repsCompleted) continue
      const name = (
        getExercise(log.exerciseId)?.name ?? log.exerciseName
      ).toLowerCase()
      if (name.includes("push-up") || name.includes("pushup"))
        totals.pushups += log.repsCompleted
      else if (name.includes("squat")) totals.squats += log.repsCompleted
      else if (name.includes("lunge")) totals.lunges += log.repsCompleted
    }
  }

  return {
    currentStreak,
    longestStreak,
    recentDays,
    weeks,
    hrSeries,
    rpeSeries,
    muscleFreq,
    topExercises,
    totals,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProgressDashboard({ app }: { app: AppApi }) {
  const m = useMemo(() => computeMetrics(app.history), [app.history])

  if (app.history.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Header />
        <div className="surface mt-6 flex flex-col items-center justify-center gap-3 py-20 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground" />
          <p className="font-display text-2xl uppercase">No data yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Complete workouts to see your progress — streaks, weekly volume,
            heart-rate trends and more will show up here.
          </p>
        </div>
      </div>
    )
  }

  const maxMuscle = Math.max(1, ...m.muscleFreq.map((d) => d.value))
  const maxExercise = Math.max(1, ...m.topExercises.map((d) => d.value))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Header />

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* STREAK */}
        <Panel
          icon={Flame}
          iconClass="text-primary"
          title="Streak"
          description="Consecutive workout days"
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <span className="font-display text-6xl tabular-nums leading-none text-primary">
                {m.currentStreak}
              </span>
              <span className="pb-1 text-sm text-muted-foreground">
                day{m.currentStreak === 1 ? "" : "s"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Longest:{" "}
              <span className="font-display tabular-nums text-foreground">
                {m.longestStreak}
              </span>{" "}
              day{m.longestStreak === 1 ? "" : "s"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.recentDays.map((d, i) => (
                <div
                  key={i}
                  title={`${formatDateShort(isoDate(d.date))}${
                    d.active ? " — workout" : ""
                  }`}
                  className={cn(
                    "h-5 w-5 rounded-sm",
                    d.active ? "bg-primary" : "bg-muted/50",
                  )}
                  style={d.active ? { opacity: 0.9 } : undefined}
                />
              ))}
            </div>
            <p className="eyebrow">Last 14 days</p>
          </div>
        </Panel>

        {/* WORKOUTS PER WEEK */}
        <Panel
          icon={CalendarDays}
          iconClass="text-primary"
          title="Workouts / week"
          description="Last 8 weeks"
        >
          <BarChart
            data={m.weeks.map((w) => ({ label: w.label, value: w.workouts }))}
            colorVar="--brand"
          />
        </Panel>

        {/* MINUTES PER WEEK */}
        <Panel
          icon={Activity}
          iconClass="text-primary"
          title="Minutes / week"
          description="Active training time"
        >
          <BarChart
            data={m.weeks.map((w) => ({ label: w.label, value: w.minutes }))}
            colorVar="--brand"
            format={(v) => `${v} min`}
          />
        </Panel>

        {/* CALORIES PER WEEK */}
        <Panel
          icon={Flame}
          iconClass="text-primary"
          title="Calories / week"
          description="Estimated kcal burned"
        >
          <BarChart
            data={m.weeks.map((w) => ({ label: w.label, value: w.calories }))}
            colorVar="--brand"
            format={(v) => `${v} kcal`}
          />
        </Panel>

        {/* AVG HR TREND */}
        <Panel
          icon={HeartPulse}
          iconClass="text-primary"
          title="Avg HR trend"
          description="Recent sessions"
        >
          {m.hrSeries.length === 0 ? (
            <EmptyHint>Log Apple Watch stats to see HR trends</EmptyHint>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl tabular-nums text-foreground">
                  {m.hrSeries[m.hrSeries.length - 1]}
                </span>
                <span className="text-xs text-muted-foreground">
                  bpm (latest)
                </span>
              </div>
              <Sparkline values={m.hrSeries} colorVar="--brand" />
            </div>
          )}
        </Panel>

        {/* RPE TREND */}
        <Panel
          icon={Gauge}
          iconClass="text-primary"
          title="RPE trend"
          description="Perceived exertion (1–10)"
        >
          {m.rpeSeries.length === 0 ? (
            <EmptyHint>Rate your effort after workouts to track RPE</EmptyHint>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl tabular-nums text-foreground">
                  {m.rpeSeries[m.rpeSeries.length - 1]}
                </span>
                <span className="text-xs text-muted-foreground">
                  / 10 (latest)
                </span>
              </div>
              <Sparkline values={m.rpeSeries} colorVar="--brand" />
            </div>
          )}
        </Panel>

        {/* MUSCLE GROUP FREQUENCY */}
        <Panel
          icon={Layers}
          iconClass="text-primary"
          title="Muscle group frequency"
          description="Sessions targeting each group"
          className="md:col-span-2 lg:col-span-2"
        >
          {m.muscleFreq.length === 0 ? (
            <EmptyHint>No muscle-group data yet</EmptyHint>
          ) : (
            <div className="space-y-2">
              {m.muscleFreq.map((d) => (
                <HBar
                  key={d.label}
                  label={d.label}
                  value={d.value}
                  max={maxMuscle}
                  colorVar="--brand"
                />
              ))}
            </div>
          )}
        </Panel>

        {/* MOST TRAINED EXERCISES */}
        <Panel
          icon={Dumbbell}
          iconClass="text-primary"
          title="Most trained"
          description="Top exercises by sets logged"
        >
          {m.topExercises.length === 0 ? (
            <EmptyHint>No exercise logs yet</EmptyHint>
          ) : (
            <div className="space-y-2">
              {m.topExercises.map((d) => (
                <HBar
                  key={d.label}
                  label={d.label}
                  value={d.value}
                  max={maxExercise}
                  colorVar="--brand"
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* TOTALS OVER TIME */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Push-ups"
          value={m.totals.pushups}
          colorVar="--work"
        />
        <StatTile label="Squats" value={m.totals.squats} colorVar="--rest" />
        <StatTile
          label="Lunges"
          value={m.totals.lunges}
          colorVar="--recovery"
        />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-primary">Insights</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-6xl uppercase leading-[0.85] sm:text-7xl">
          <TrendingUp className="size-10 text-primary sm:size-12" />
          Progress
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your training trends, all derived from completed workouts.
        </p>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  colorVar,
}: {
  label: string
  value: number
  colorVar: string
}) {
  void colorVar
  return (
    <div className="surface flex flex-col gap-1 p-5">
      <span className="eyebrow">Total {label}</span>
      <span className="font-display text-5xl tabular-nums text-primary">
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground">reps logged</span>
    </div>
  )
}
