// ===========================================================================
// Core domain types — the shared contract for the whole app.
// Predefined templates are NEVER mutated; user edits create custom templates.
// History (sessions/logs) is kept strictly separate from templates.
// ===========================================================================

export type Difficulty = "Beginner" | "Intermediate" | "Advanced"

export type Goal =
  | "fat_loss"
  | "strength"
  | "general_fitness"
  | "mobility"
  | "recovery"

export type ExerciseCategory = "strength" | "cardio" | "mobility" | "core"

export type MovementPattern =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "core"
  | "mobility"
  | "cardio"

export type MuscleGroup =
  | "chest"
  | "shoulders"
  | "triceps"
  | "biceps"
  | "back"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "hip_flexors"
  | "full_body"
  | "cardio"

/** How an exercise block is measured. */
export type ExerciseMode = "time" | "reps"

export type Units = "metric" | "imperial"

export type WorkoutStyle = "strength" | "hiit" | "low_impact" | "mobility" | "mixed"

/** Key into the SVG pose library (src/data/poses.ts). */
export type IllustrationType = string

// ---------------------------------------------------------------------------
// Exercise database
// ---------------------------------------------------------------------------

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  primaryMuscles: MuscleGroup[]
  secondaryMuscles: MuscleGroup[]
  movementPattern: MovementPattern
  difficulty: Difficulty
  defaultMode: ExerciseMode
  /** Default seconds for time-mode exercises. */
  defaultDurationSec: number
  /** Default reps per set for rep-mode exercises. */
  defaultReps: number
  /** Default number of sets (1 for pure time-based holds/cardio). */
  defaultSets: number
  /** Default rest after each set, in seconds. */
  defaultRestSec: number
  /** True when reps are counted per side (lunges, side plank, etc.). */
  perSide?: boolean
  techniqueTips: string[]
  commonMistakes: string[]
  easierVariation: string
  harderVariation: string
  illustration: IllustrationType
}

// ---------------------------------------------------------------------------
// Workout templates (predefined + custom)
// ---------------------------------------------------------------------------

/** One exercise as configured within a workout template. */
export interface WorkoutBlock {
  /** Stable id within the template (for reorder/remove). */
  id: string
  exerciseId: string
  mode: ExerciseMode
  /** Seconds, used when mode === "time". */
  durationSec: number
  /** Reps per set, used when mode === "reps". */
  reps: number
  sets: number
  restSec: number
  /** Optional per-block note shown in the player. */
  note?: string
}

export type ScalingOption = "easier" | "standard" | "harder"

export interface WorkoutTemplate {
  id: string
  name: string
  description: string
  goal: Goal
  difficulty: Difficulty
  /** Estimated total minutes (display). Actual time derives from blocks. */
  estimatedMinutes: number
  /** Equipment required; ["None"] for bodyweight-only. */
  equipment: string[]
  /** Aggregated muscle groups (display/filtering). */
  muscleGroups: MuscleGroup[]
  /** Estimated calorie range [min, max]. */
  estimatedCalories: [number, number]
  blocks: WorkoutBlock[]
  /** True for user-created/edited templates. Predefined are false. */
  isCustom: boolean
  /** ISO timestamp; custom only. */
  createdAt?: string
  updatedAt?: string
}

// ---------------------------------------------------------------------------
// Workout sessions + logs (history) — NEVER mixed with templates
// ---------------------------------------------------------------------------

/** A single logged set within a completed session. */
export interface ExerciseLog {
  exerciseId: string
  exerciseName: string
  mode: ExerciseMode
  /** Index of the set (0-based) within the exercise. */
  setIndex: number
  /** Reps actually completed (rep mode). */
  repsCompleted?: number
  /** Seconds actually held/worked (time mode). */
  durationSec?: number
  /** Optional weight if the user logged one. */
  weight?: number
  completed: boolean
}

export type FeelRating = "easy" | "good" | "hard" | "brutal"

/** Manually entered post-workout stats (e.g. from an Apple Watch). */
export interface WatchStats {
  avgHr?: number
  activeKcal?: number
  totalKcal?: number
  /** Duration in seconds, if the user overrides the measured time. */
  durationSec?: number
}

export interface WorkoutSession {
  id: string
  /** ISO date (YYYY-MM-DD). */
  date: string
  /** ISO timestamp of completion. */
  completedAt: string
  templateId: string
  templateName: string
  goal: Goal
  difficulty: Difficulty
  muscleGroups: MuscleGroup[]
  /** Measured active seconds (timestamp-based, excludes paused time). */
  durationSec: number
  exercisesCompleted: number
  exercisesTotal: number
  setsCompleted: number
  repsCompleted: number
  /** Estimated calories (MET-based approximation). */
  estimatedCalories: number
  /** Rate of perceived exertion, 1–10. */
  rpe?: number
  feel?: FeelRating
  notes?: string
  watch?: WatchStats
  logs: ExerciseLog[]
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface UserSettings {
  name: string
  goal: Goal
  fitnessLevel: Difficulty
  defaultDurationMin: number
  soundEnabled: boolean
  volume: number
  /** Preferred rest between sets, seconds. */
  defaultRestSec: number
  units: Units
  /** Bodyweight for calorie approximation (kg internally). */
  bodyweightKg: number
  preferredStyle: WorkoutStyle
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

/** Minutes the user has available now. */
export type TimeAvailable = 10 | 15 | 20 | 30 | 45

export interface Recommendation {
  templateId: string
  /** Human-facing explanation, e.g. "Suggested because legs were trained yesterday." */
  reason: string
  /** Short tag, e.g. "Recovery", "Conditioning". */
  tag: string
}

// ---------------------------------------------------------------------------
// Persistence envelope (export/import)
// ---------------------------------------------------------------------------

export interface AppData {
  /** Schema version for migrations. */
  version: number
  settings: UserSettings
  customTemplates: WorkoutTemplate[]
  history: WorkoutSession[]
  lastGoal: Goal
}

// ---------------------------------------------------------------------------
// Player runtime (not persisted) — a flattened, playable interval list
// ---------------------------------------------------------------------------

export type PlayerSegmentType = "WORK" | "REST" | "PREP"

/** One playable segment in the guided player (a set, a rest, or prep). */
export interface PlayerSegment {
  id: string
  blockId: string
  exerciseId: string
  exerciseName: string
  type: PlayerSegmentType
  mode: ExerciseMode
  /** Set number (1-based) for WORK segments. */
  setNumber: number
  totalSets: number
  /** Seconds for time-mode WORK and all REST/PREP segments. */
  durationSec: number
  /** Target reps for rep-mode WORK segments. */
  targetReps: number
  perSide: boolean
  instruction: string
  tip: string
  illustration: IllustrationType
  /** Name of the next exercise (display), or null at the end. */
  nextExerciseName: string | null
}
