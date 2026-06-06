import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { getExercise } from "@/data/exercises"
import { poseSvg } from "@/data/poses"
import { useAudio } from "@/hooks/useAudio"
import { useWorkoutTimer } from "@/hooks/useWorkoutTimer"
import type { AppApi } from "@/lib/appState"
import { difficultyToIntensity, estimateSessionCalories } from "@/lib/calories"
import { formatTime, isoDate } from "@/lib/format"
import { buildPlayerSegments } from "@/lib/template"
import type {
  ExerciseLog,
  FeelRating,
  PlayerSegment,
  WatchStats,
  WorkoutSession,
  WorkoutTemplate,
} from "@/types"

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "You don't have to be extreme, just consistent.",
  "Sweat now, shine later.",
  "Discipline is choosing what you want most over what you want now.",
  "One more rep. One more breath. One step closer.",
  "Your body can stand almost anything. It's your mind you have to convince.",
]

const QUOTE_ROTATE_MS = 25_000

const FEEL_OPTIONS: { value: FeelRating; label: string; emoji: string }[] = [
  { value: "easy", label: "Easy", emoji: "😎" },
  { value: "good", label: "Good", emoji: "💪" },
  { value: "hard", label: "Hard", emoji: "😤" },
  { value: "brutal", label: "Brutal", emoji: "🔥" },
]

const WORK_COLOR = "hsl(22 95% 54%)" // brand orange = effort
const REST_COLOR = "hsl(45 93% 55%)" // amber
const PREP_COLOR = "hsl(199 89% 55%)" // cyan = breathe

function segmentColor(type: PlayerSegment["type"]): string {
  if (type === "WORK") return WORK_COLOR
  if (type === "REST") return REST_COLOR
  return PREP_COLOR
}

function typeLabel(seg: PlayerSegment): string {
  if (seg.type === "WORK") return "WORK"
  if (seg.type === "REST") return "REST"
  return "GET READY"
}

function typeAccentClass(type: PlayerSegment["type"]): string {
  if (type === "WORK") return "text-work border-work/50 bg-work/10"
  if (type === "REST") return "text-rest border-rest/50 bg-rest/10"
  return "text-recovery border-recovery/50 bg-recovery/10"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkoutPlayer({
  app,
  template,
  onExit,
}: {
  app: AppApi
  template: WorkoutTemplate
  onExit: () => void
}) {
  const segments = useMemo(() => buildPlayerSegments(template), [template])

  const [started, setStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Reps completed per WORK segment id (defaults to targetReps).
  const [repsMap, setRepsMap] = useState<Record<string, number>>({})

  // Accumulated active (working) seconds across the whole workout.
  // A ref is the source of truth (read at completion); the setter just nudges a
  // render so any live display stays current.
  const [, bumpAccumulated] = useState(0)
  const accumulatedRef = useRef(0)
  const setAccumulatedSec = (v: number) => bumpAccumulated(v)

  // Quote rotation.
  const [quoteIndex, setQuoteIndex] = useState(0)

  const audio = useAudio({
    enabled: app.settings.soundEnabled,
    volume: app.settings.volume,
  })

  const total = segments.length
  const current: PlayerSegment | undefined = segments[currentIndex]

  // Ensure a rep value exists for the current rep-WORK segment.
  useEffect(() => {
    if (!current) return
    if (current.type === "WORK" && current.mode === "reps") {
      setRepsMap((prev) =>
        prev[current.id] === undefined
          ? { ...prev, [current.id]: current.targetReps }
          : prev,
      )
    }
  }, [current])

  // Is the current segment a manual (rep-based WORK) segment?
  const isRepWork =
    !!current && current.type === "WORK" && current.mode === "reps"

  // The timer only drives time-based WORK and all REST/PREP segments.
  const timerRunning = started && running && !finished && !isRepWork

  // --- finish ------------------------------------------------------------
  const finishWorkout = useCallback(() => {
    setRunning(false)
    setFinished(true)
  }, [])

  // --- advance / navigation ---------------------------------------------
  const advanceFrom = useCallback(
    (index: number) => {
      const next = index + 1
      if (next >= total) {
        finishWorkout()
      } else {
        setCurrentIndex(next)
      }
    },
    [total, finishWorkout],
  )

  // Timer completion for time/rest/prep segments → accumulate work time, advance.
  const handleTimerComplete = useCallback(() => {
    setCurrentIndex((idx) => {
      const seg = segments[idx]
      if (seg && seg.type === "WORK") {
        accumulatedRef.current += seg.durationSec
        setAccumulatedSec(accumulatedRef.current)
      }
      const next = idx + 1
      if (next >= total) {
        finishWorkout()
        return idx
      }
      return next
    })
  }, [segments, total, finishWorkout])

  // Countdown beeps in the last 3 seconds (guard to fire once per second).
  const lastBeepRef = useRef(-1)
  const handleSecondTick = useCallback(
    (secondsRemaining: number) => {
      if (
        secondsRemaining > 0 &&
        secondsRemaining <= 3 &&
        secondsRemaining !== lastBeepRef.current
      ) {
        lastBeepRef.current = secondsRemaining
        audio.playCountdownBeep()
      }
    },
    [audio],
  )

  const timer = useWorkoutTimer({
    durationSec: current?.durationSec ?? 0,
    running: timerRunning,
    onComplete: handleTimerComplete,
    onSecondTick: handleSecondTick,
  })

  // Reset the countdown-beep guard whenever the segment changes.
  useEffect(() => {
    lastBeepRef.current = -1
  }, [currentIndex])

  // --- entering-a-segment cues (keyed on currentIndex) -------------------
  const prevPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    if (!started || finished || !current) return
    const phaseChanged = prevPhaseRef.current !== current.exerciseName
    if (current.type === "WORK") {
      audio.playStartBeep()
    } else {
      audio.playRestBeep()
    }
    if (phaseChanged && prevPhaseRef.current !== null) {
      audio.playPhaseChime()
    }
    prevPhaseRef.current = current.exerciseName
    // Only re-run when the active segment changes (or on start).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, started, finished])

  // --- completion chime --------------------------------------------------
  useEffect(() => {
    if (finished) audio.playCompleteChime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  // --- quote rotation ----------------------------------------------------
  useEffect(() => {
    if (finished) return
    const id = window.setInterval(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length)
    }, QUOTE_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [finished])

  // --- controls ----------------------------------------------------------
  const start = useCallback(() => {
    audio.unlock()
    setStarted(true)
    setFinished(false)
    setRunning(true)
  }, [audio])

  const togglePause = useCallback(() => {
    if (!started || finished) return
    setRunning((r) => !r)
  }, [started, finished])

  const skip = useCallback(() => {
    if (!started || finished) return
    setCurrentIndex((idx) => {
      const seg = segments[idx]
      // Count partial work time toward the total when skipping a WORK segment.
      if (seg && seg.type === "WORK") {
        const done =
          seg.mode === "time"
            ? Math.min(seg.durationSec, Math.round(timer.elapsedSec))
            : seg.targetReps > 0
              ? seg.durationSec
              : 0
        accumulatedRef.current += done
        setAccumulatedSec(accumulatedRef.current)
      }
      const next = idx + 1
      if (next >= total) {
        finishWorkout()
        return idx
      }
      return next
    })
  }, [started, finished, segments, total, finishWorkout, timer.elapsedSec])

  const previous = useCallback(() => {
    if (!started || finished) return
    setCurrentIndex((idx) => Math.max(0, idx - 1))
  }, [started, finished])

  // Complete a rep-based WORK set: accumulate its estimated work time, advance.
  const completeSet = useCallback(() => {
    if (!current) return
    accumulatedRef.current += Math.max(
      0,
      current.targetReps * 3, // ~3s/rep, matches template estimation
    )
    setAccumulatedSec(accumulatedRef.current)
    advanceFrom(currentIndex)
  }, [current, currentIndex, advanceFrom])

  const restart = useCallback(() => {
    setRunning(false)
    setFinished(false)
    setStarted(false)
    setCurrentIndex(0)
    setRepsMap({})
    accumulatedRef.current = 0
    setAccumulatedSec(0)
    prevPhaseRef.current = null
    lastBeepRef.current = -1
    timer.reset()
  }, [timer])

  const requestExit = useCallback(() => {
    if (started && !finished) {
      setShowExitConfirm(true)
    } else {
      onExit()
    }
  }, [started, finished, onExit])

  // --- rep adjuster ------------------------------------------------------
  const currentReps =
    current && repsMap[current.id] !== undefined
      ? repsMap[current.id]
      : (current?.targetReps ?? 0)

  const adjustReps = useCallback(
    (delta: number) => {
      if (!current) return
      setRepsMap((prev) => {
        const base = prev[current.id] ?? current.targetReps
        return { ...prev, [current.id]: Math.max(0, base + delta) }
      })
    },
    [current],
  )

  // --- sound controls ----------------------------------------------------
  const toggleSound = useCallback(
    (next: boolean) => {
      audio.setEnabled(next)
      app.updateSettings({ soundEnabled: next })
    },
    [audio, app],
  )

  const changeVolume = useCallback(
    (next: number) => {
      audio.setVolume(next)
      app.updateSettings({ volume: next })
    },
    [audio, app],
  )

  // --- keyboard shortcuts ------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return
      }
      if (e.code === "Space") {
        e.preventDefault()
        if (!started) start()
        else togglePause()
      } else if (e.code === "ArrowLeft") {
        e.preventDefault()
        previous()
      } else if (e.code === "ArrowRight") {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [started, finished, start, togglePause, previous, skip])

  // -----------------------------------------------------------------------
  // Completion screen
  // -----------------------------------------------------------------------
  if (finished) {
    return (
      <CompletionScreen
        app={app}
        template={template}
        segments={segments}
        reachedIndex={currentIndex}
        repsMap={repsMap}
        accumulatedSec={accumulatedRef.current}
        onExit={onExit}
      />
    )
  }

  // -----------------------------------------------------------------------
  // No segments (empty template)
  // -----------------------------------------------------------------------
  if (!current) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-lg text-muted-foreground">
          This workout has no exercises.
        </p>
        <Button onClick={onExit}>Back</Button>
      </div>
    )
  }

  const color = segmentColor(current.type)
  const exercise = getExercise(current.exerciseId)
  const illustrationKey = exercise?.illustration ?? "stand"
  const svg = poseSvg(illustrationKey, color)
  const remaining = timer.remainingSec
  const timerColorClass =
    remaining <= 3 ? "text-destructive" : remaining <= 5 ? "text-rest" : ""

  const completedSegments = currentIndex // segments before current are done
  const overallProgress = total > 0 ? (completedSegments / total) * 100 : 0

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* Start overlay */}
      {!started && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur">
          <p className="eyebrow text-primary">Ready to go</p>
          <h1 className="text-center font-display text-6xl uppercase leading-[0.9]">
            {template.name}
          </h1>
          <p className="max-w-md text-center text-muted-foreground">
            {total} segments · Press Start (or Space) to begin. Cues will guide
            you through every set.
          </p>
          <button
            onClick={start}
            className="glow-cta flex h-16 items-center gap-3 rounded-[var(--radius)] bg-primary px-12 font-display text-2xl uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
          >
            <Play className="size-6 fill-current" /> Start workout
          </button>
          <Button variant="ghost" onClick={onExit}>
            Cancel
          </Button>
        </div>
      )}

      {/* Top bar */}
      <header className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            Exercise {currentIndex + 1} of {total}
          </p>
          <Progress value={overallProgress} className="mt-2 h-1.5" />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={audio.enabled ? "Mute" : "Unmute"}
            onClick={() => toggleSound(!audio.enabled)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {audio.enabled ? (
              <Volume2 className="size-5" />
            ) : (
              <VolumeX className="size-5" />
            )}
          </button>
          <Slider
            className="w-24"
            min={0}
            max={1}
            step={0.05}
            value={[audio.volume]}
            onValueChange={(v) => changeVolume(v[0] ?? 0)}
          />
          <button
            type="button"
            aria-label="Exit workout"
            onClick={requestExit}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-6" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="grid flex-1 grid-cols-1 gap-6 px-5 pb-4 lg:grid-cols-3">
        {/* Center column */}
        <section className="order-1 flex flex-col items-center justify-center gap-5 lg:col-span-2">
          <div
            className="size-52 sm:size-64"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <span
            className={`rounded border px-4 py-1 font-display text-sm uppercase tracking-[0.2em] ${typeAccentClass(
              current.type,
            )}`}
          >
            {typeLabel(current)}
          </span>

          <h2
            className="text-center font-display text-5xl uppercase leading-[0.9] sm:text-6xl"
            style={{ color }}
          >
            {current.type === "REST" ? "Rest" : current.exerciseName}
          </h2>

          {current.type === "WORK" && (
            <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">
              Set {current.setNumber} / {current.totalSets}
            </p>
          )}

          {current.instruction && (
            <p className="max-w-md text-center text-muted-foreground">
              {current.instruction}
            </p>
          )}

          {/* Timer OR rep adjuster */}
          {isRepWork ? (
            <div className="flex flex-col items-center gap-5">
              <div className="text-center">
                <span className="font-display text-8xl sm:text-9xl" style={{ color }}>
                  {current.targetReps}
                </span>
                <span className="ml-2 font-display text-2xl uppercase text-muted-foreground">
                  reps
                </span>
                {current.perSide && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    × each side
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Completed</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-12 rounded-full"
                  onClick={() => adjustReps(-1)}
                  aria-label="Decrease reps"
                >
                  <Minus className="size-5" />
                </Button>
                <span className="w-12 text-center text-3xl font-bold tabular-nums">
                  {currentReps}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-12 rounded-full"
                  onClick={() => adjustReps(1)}
                  aria-label="Increase reps"
                >
                  <Plus className="size-5" />
                </Button>
              </div>

              <button
                onClick={completeSet}
                className="glow-cta flex h-14 items-center gap-2 rounded-[var(--radius)] bg-primary px-12 font-display text-lg uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
              >
                <Check className="size-5" /> Complete set
              </button>
            </div>
          ) : (
            <div
              className={`font-display text-[7rem] leading-none tabular-nums sm:text-[11rem] ${timerColorClass} ${remaining <= 5 && remaining > 0 ? "animate-pulse-timer" : ""}`}
              style={timerColorClass ? undefined : { color }}
            >
              {formatTime(remaining)}
            </div>
          )}

          {current.nextExerciseName && (
            <p className="text-sm text-muted-foreground">
              Next:{" "}
              <span className="font-medium text-foreground">
                {current.nextExerciseName}
              </span>
            </p>
          )}
        </section>

        {/* Motivation panel */}
        <aside className="order-2 flex flex-col gap-4">
          <div className="surface p-5">
            <p className="eyebrow mb-2 text-primary">Motivation</p>
            <p
              key={quoteIndex}
              className="animate-soft-swap font-display text-xl uppercase leading-tight"
            >
              {QUOTES[quoteIndex]}
            </p>
          </div>
          {current.tip && (
            <div className="surface p-5">
              <p className="eyebrow mb-2">Technique tip</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {current.tip}
              </p>
            </div>
          )}
        </aside>
      </main>

      {/* Bottom controls */}
      <footer className="flex items-center justify-center gap-3 border-t border-border/50 px-5 py-5">
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={previous}
          disabled={currentIndex === 0}
        >
          <SkipBack className="size-5" /> Prev
        </Button>

        {!isRepWork && (
          <Button
            size="lg"
            className="h-14 w-40 gap-2 text-lg"
            onClick={togglePause}
          >
            {running ? (
              <>
                <Pause className="size-5" /> Pause
              </>
            ) : (
              <>
                <Play className="size-5" /> Resume
              </>
            )}
          </Button>
        )}

        <Button variant="outline" size="lg" className="gap-2" onClick={skip}>
          Skip <SkipForward className="size-5" />
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className="gap-2"
          onClick={restart}
          aria-label="Restart workout"
        >
          <RotateCcw className="size-5" /> Restart
        </Button>
      </footer>

      {/* Exit confirmation */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave workout?</DialogTitle>
            <DialogDescription>
              Your progress for this session won't be saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExitConfirm(false)}
            >
              Keep going
            </Button>
            <Button variant="destructive" onClick={onExit}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completion screen
// ---------------------------------------------------------------------------

function CompletionScreen({
  app,
  template,
  segments,
  reachedIndex,
  repsMap,
  accumulatedSec,
  onExit,
}: {
  app: AppApi
  template: WorkoutTemplate
  segments: PlayerSegment[]
  reachedIndex: number
  repsMap: Record<string, number>
  accumulatedSec: number
  onExit: () => void
}) {
  const [feel, setFeel] = useState<FeelRating | undefined>(undefined)
  const [rpe, setRpe] = useState(6)
  const [notes, setNotes] = useState("")
  const [avgHr, setAvgHr] = useState("")
  const [totalKcal, setTotalKcal] = useState("")
  const [activeKcal, setActiveKcal] = useState("")
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // A segment counts as "completed" if it was fully passed (index < reachedIndex).
  // The segment at reachedIndex is the one we finished ON (the last one), so the
  // final segment also counts as completed when finishing.
  const completedCount = Math.min(reachedIndex + 1, segments.length)
  const completedSegments = segments.slice(0, completedCount)

  const workSegments = completedSegments.filter((s) => s.type === "WORK")
  const setsCompleted = workSegments.length
  const distinctExercises = new Set(
    completedSegments
      .filter((s) => s.type !== "REST" && s.type !== "PREP")
      .map((s) => s.exerciseId),
  )
  const exercisesCompleted = distinctExercises.size
  const exercisesTotal = new Set(template.blocks.map((b) => b.exerciseId)).size

  const repsCompleted = workSegments.reduce((sum, s) => {
    if (s.mode === "reps") {
      const r = repsMap[s.id] !== undefined ? repsMap[s.id] : s.targetReps
      return sum + r
    }
    return sum
  }, 0)

  const estimatedCalories = estimateSessionCalories(
    accumulatedSec,
    difficultyToIntensity(template.difficulty),
    app.settings.bodyweightKg,
  )

  const handleSave = useCallback(() => {
    const watch: WatchStats | undefined = (() => {
      const w: WatchStats = {}
      if (avgHr.trim()) w.avgHr = Number(avgHr)
      if (totalKcal.trim()) w.totalKcal = Number(totalKcal)
      if (activeKcal.trim()) w.activeKcal = Number(activeKcal)
      return Object.keys(w).length ? w : undefined
    })()

    const logs: ExerciseLog[] = workSegments.map((s) => ({
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      mode: s.mode,
      setIndex: s.setNumber - 1,
      repsCompleted:
        s.mode === "reps"
          ? repsMap[s.id] !== undefined
            ? repsMap[s.id]
            : s.targetReps
          : undefined,
      durationSec: s.mode === "time" ? s.durationSec : undefined,
      completed: true,
    }))

    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      date: isoDate(),
      completedAt: new Date().toISOString(),
      templateId: template.id,
      templateName: template.name,
      goal: template.goal,
      difficulty: template.difficulty,
      muscleGroups: template.muscleGroups,
      durationSec: watch?.durationSec ?? accumulatedSec,
      exercisesCompleted,
      exercisesTotal,
      setsCompleted,
      repsCompleted,
      estimatedCalories,
      rpe,
      feel,
      notes: notes.trim() || undefined,
      watch,
      logs,
    }

    app.saveSession(session)
    onExit()
  }, [
    app,
    template,
    accumulatedSec,
    workSegments,
    repsMap,
    exercisesCompleted,
    exercisesTotal,
    setsCompleted,
    repsCompleted,
    estimatedCalories,
    rpe,
    feel,
    notes,
    avgHr,
    totalKcal,
    activeKcal,
    onExit,
  ])

  return (
    <div className="min-h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="text-center">
          <p className="eyebrow text-primary">Well done</p>
          <h1 className="mt-2 font-display text-6xl uppercase leading-[0.9]">
            Workout
            <br />
            complete
          </h1>
        </div>

        {/* Stats grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Active time" value={formatTime(accumulatedSec)} />
          <StatTile label="Exercises" value={String(exercisesCompleted)} />
          <StatTile label="Sets" value={String(setsCompleted)} />
          <StatTile label="Reps" value={String(repsCompleted)} />
          <StatTile label="Calories" value={`${estimatedCalories}`} />
          <StatTile
            label="RPE"
            value={`${rpe}/10`}
          />
        </div>

        {/* Feel */}
        <div className="mt-8">
          <Label className="text-base">How did it feel?</Label>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {FEEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFeel(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                  feel === opt.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* RPE */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <Label className="text-base">Perceived exertion (RPE)</Label>
            <span className="text-lg font-semibold tabular-nums">{rpe}</span>
          </div>
          <Slider
            className="mt-3"
            min={1}
            max={10}
            step={1}
            value={[rpe]}
            onValueChange={(v) => setRpe(v[0] ?? rpe)}
          />
        </div>

        {/* Notes */}
        <div className="mt-8">
          <Label htmlFor="notes" className="text-base">
            Notes
          </Label>
          <Textarea
            id="notes"
            className="mt-3"
            placeholder="How did the session go?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Watch stats */}
        <div className="mt-8">
          <Label className="text-base">Apple Watch stats (optional)</Label>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="avgHr" className="text-xs text-muted-foreground">
                Avg HR
              </Label>
              <Input
                id="avgHr"
                type="number"
                inputMode="numeric"
                className="mt-1"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor="totalKcal"
                className="text-xs text-muted-foreground"
              >
                Total kcal
              </Label>
              <Input
                id="totalKcal"
                type="number"
                inputMode="numeric"
                className="mt-1"
                value={totalKcal}
                onChange={(e) => setTotalKcal(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor="activeKcal"
                className="text-xs text-muted-foreground"
              >
                Active kcal
              </Label>
              <Input
                id="activeKcal"
                type="number"
                inputMode="numeric"
                className="mt-1"
                value={activeKcal}
                onChange={(e) => setActiveKcal(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button
            className="glow-cta flex h-14 flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary font-display text-lg uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
            onClick={handleSave}
          >
            <Check className="size-5" /> Save workout
          </button>
          <Button
            variant="outline"
            size="lg"
            className="h-14"
            onClick={() => setShowDiscardConfirm(true)}
          >
            Discard
          </Button>
        </div>
      </div>

      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this session?</DialogTitle>
            <DialogDescription>
              This workout won't be added to your history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDiscardConfirm(false)}
            >
              Keep
            </Button>
            <Button variant="destructive" onClick={onExit}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4 text-center">
      <p className="font-display text-4xl leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 eyebrow">{label}</p>
    </div>
  )
}
