// Predefined workout templates. NEVER mutated at runtime — user edits create
// custom copies (see lib/template.ts duplicateTemplate / applyScaling).
import type { MuscleGroup, WorkoutBlock, WorkoutTemplate } from "@/types"
import { getExercise } from "@/data/exercises"

let blockCounter = 0
/** Deterministic block id so predefined templates are stable across reloads. */
function bid(templateId: string): string {
  blockCounter += 1
  return `${templateId}-b${blockCounter}`
}

/** Build a block from an exercise's defaults, with optional overrides. */
function block(
  templateId: string,
  exerciseId: string,
  overrides: Partial<Omit<WorkoutBlock, "id" | "exerciseId">> = {},
): WorkoutBlock {
  const ex = getExercise(exerciseId)
  return {
    id: bid(templateId),
    exerciseId,
    mode: overrides.mode ?? ex?.defaultMode ?? "time",
    durationSec: overrides.durationSec ?? ex?.defaultDurationSec ?? 40,
    reps: overrides.reps ?? ex?.defaultReps ?? 12,
    sets: overrides.sets ?? ex?.defaultSets ?? 3,
    restSec: overrides.restSec ?? ex?.defaultRestSec ?? 20,
    note: overrides.note,
  }
}

function muscles(blocks: WorkoutBlock[]): MuscleGroup[] {
  const set = new Set<MuscleGroup>()
  for (const b of blocks) {
    const ex = getExercise(b.exerciseId)
    ex?.primaryMuscles.forEach((m) => set.add(m))
  }
  return [...set]
}

interface TemplateSeed {
  id: string
  name: string
  description: string
  goal: WorkoutTemplate["goal"]
  difficulty: WorkoutTemplate["difficulty"]
  estimatedMinutes: number
  estimatedCalories: [number, number]
  exercises: Array<[string, Partial<Omit<WorkoutBlock, "id" | "exerciseId">>?]>
}

function make(seed: TemplateSeed): WorkoutTemplate {
  const blocks = seed.exercises.map(([exId, ov]) => block(seed.id, exId, ov ?? {}))
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    goal: seed.goal,
    difficulty: seed.difficulty,
    estimatedMinutes: seed.estimatedMinutes,
    equipment: ["None"],
    muscleGroups: muscles(blocks),
    estimatedCalories: seed.estimatedCalories,
    blocks,
    isCustom: false,
  }
}

export const PREDEFINED_TEMPLATES: WorkoutTemplate[] = [
  // --- A. Fat Loss / Conditioning ---
  make({
    id: "beginner-bodyweight-circuit",
    name: "Beginner Bodyweight Circuit",
    description: "Gentle full-body circuit to build a base. Move at your own pace.",
    goal: "fat_loss",
    difficulty: "Beginner",
    estimatedMinutes: 20,
    estimatedCalories: [110, 170],
    exercises: [
      ["jumping-jack", { mode: "time", durationSec: 30, sets: 1, restSec: 15 }],
      ["bodyweight-squat", { mode: "reps", reps: 12, sets: 2, restSec: 30 }],
      ["knee-push-up", { mode: "reps", reps: 8, sets: 2, restSec: 30 }],
      ["glute-bridge", { mode: "reps", reps: 12, sets: 2, restSec: 30 }],
      ["plank", { mode: "time", durationSec: 25, sets: 2, restSec: 30 }],
      ["high-knees", { mode: "time", durationSec: 30, sets: 1, restSec: 15 }],
    ],
  }),
  make({
    id: "full-body-hiit",
    name: "30 Min Full-Body HIIT",
    description: "High-intensity intervals torching the whole body. Bring effort.",
    goal: "fat_loss",
    difficulty: "Intermediate",
    estimatedMinutes: 30,
    estimatedCalories: [260, 360],
    exercises: [
      ["jumping-jack", { mode: "time", durationSec: 40, sets: 1, restSec: 20 }],
      ["burpee", { mode: "time", durationSec: 40, sets: 3, restSec: 20 }],
      ["mountain-climber", { mode: "time", durationSec: 40, sets: 3, restSec: 20 }],
      ["jump-squat", { mode: "time", durationSec: 40, sets: 3, restSec: 20 }],
      ["push-up", { mode: "reps", reps: 12, sets: 3, restSec: 25 }],
      ["high-knees", { mode: "time", durationSec: 40, sets: 2, restSec: 20 }],
    ],
  }),
  make({
    id: "quick-sweat",
    name: "15 Min Quick Sweat",
    description: "Short, sharp conditioning blast for busy days.",
    goal: "fat_loss",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    estimatedCalories: [130, 190],
    exercises: [
      ["jumping-jack", { mode: "time", durationSec: 40, sets: 1, restSec: 15 }],
      ["squat-thrust", { mode: "time", durationSec: 30, sets: 3, restSec: 15 }],
      ["mountain-climber", { mode: "time", durationSec: 30, sets: 3, restSec: 15 }],
      ["high-knees", { mode: "time", durationSec: 30, sets: 2, restSec: 15 }],
    ],
  }),
  make({
    id: "low-impact-cardio",
    name: "Low-Impact Cardio Circuit",
    description: "Heart-rate work that's easy on the joints. No jumping.",
    goal: "fat_loss",
    difficulty: "Beginner",
    estimatedMinutes: 20,
    estimatedCalories: [120, 180],
    exercises: [
      ["step-jack", { mode: "time", durationSec: 40, sets: 1, restSec: 15 }],
      ["bodyweight-squat", { mode: "reps", reps: 14, sets: 2, restSec: 25 }],
      ["reverse-lunge", { mode: "reps", reps: 10, sets: 2, restSec: 25 }],
      ["shoulder-taps", { mode: "time", durationSec: 30, sets: 2, restSec: 20 }],
      ["glute-bridge", { mode: "reps", reps: 14, sets: 2, restSec: 20 }],
    ],
  }),

  // --- B. Strength ---
  make({
    id: "push-strength",
    name: "Push Strength",
    description: "Upper-body pressing focus: chest, shoulders, triceps.",
    goal: "strength",
    difficulty: "Intermediate",
    estimatedMinutes: 25,
    estimatedCalories: [150, 220],
    exercises: [
      ["push-up", { mode: "reps", reps: 12, sets: 3, restSec: 60 }],
      ["pike-push-up", { mode: "reps", reps: 8, sets: 3, restSec: 60 }],
      ["shoulder-taps", { mode: "time", durationSec: 30, sets: 3, restSec: 45 }],
      ["tricep-dip", { mode: "reps", reps: 10, sets: 3, restSec: 60 }],
    ],
  }),
  make({
    id: "lower-body-strength",
    name: "Lower Body Strength",
    description: "Squats, lunges, bridges, calves — build resilient legs.",
    goal: "strength",
    difficulty: "Intermediate",
    estimatedMinutes: 28,
    estimatedCalories: [170, 240],
    exercises: [
      ["bodyweight-squat", { mode: "reps", reps: 15, sets: 4, restSec: 60 }],
      ["reverse-lunge", { mode: "reps", reps: 12, sets: 3, restSec: 60 }],
      ["glute-bridge", { mode: "reps", reps: 15, sets: 3, restSec: 45 }],
      ["calf-raise", { mode: "reps", reps: 18, sets: 3, restSec: 45 }],
    ],
  }),
  make({
    id: "core-strength",
    name: "Core Strength",
    description: "Planks, dead bugs, climbers, hollow holds for a braced midline.",
    goal: "strength",
    difficulty: "Intermediate",
    estimatedMinutes: 20,
    estimatedCalories: [120, 180],
    exercises: [
      ["plank", { mode: "time", durationSec: 40, sets: 3, restSec: 30 }],
      ["dead-bug", { mode: "time", durationSec: 40, sets: 3, restSec: 30 }],
      ["mountain-climber", { mode: "time", durationSec: 30, sets: 3, restSec: 30 }],
      ["hollow-hold", { mode: "time", durationSec: 30, sets: 3, restSec: 30 }],
    ],
  }),
  make({
    id: "full-body-strength",
    name: "Full-Body Strength Circuit",
    description: "One pass through every major pattern. Balanced and efficient.",
    goal: "strength",
    difficulty: "Advanced",
    estimatedMinutes: 35,
    estimatedCalories: [220, 320],
    exercises: [
      ["bodyweight-squat", { mode: "reps", reps: 15, sets: 3, restSec: 60 }],
      ["push-up", { mode: "reps", reps: 12, sets: 3, restSec: 60 }],
      ["reverse-lunge", { mode: "reps", reps: 12, sets: 3, restSec: 60 }],
      ["pike-push-up", { mode: "reps", reps: 8, sets: 3, restSec: 60 }],
      ["glute-bridge", { mode: "reps", reps: 15, sets: 3, restSec: 45 }],
      ["plank", { mode: "time", durationSec: 45, sets: 2, restSec: 45 }],
    ],
  }),

  // --- C. Mobility / Recovery ---
  make({
    id: "ten-min-mobility",
    name: "10 Min Mobility",
    description: "Quick joint prep to move better. Great as a warm-up or reset.",
    goal: "mobility",
    difficulty: "Beginner",
    estimatedMinutes: 10,
    estimatedCalories: [30, 60],
    exercises: [
      ["arm-circles", { mode: "time", durationSec: 30, sets: 1, restSec: 5 }],
      ["hip-circle", { mode: "time", durationSec: 30, sets: 1, restSec: 5 }],
      ["cat-cow", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
      ["worlds-greatest-stretch", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
      ["downward-dog", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
    ],
  }),
  make({
    id: "fifteen-min-stretching",
    name: "15 Min Stretching",
    description: "Full-body static stretch to unwind and improve range.",
    goal: "recovery",
    difficulty: "Beginner",
    estimatedMinutes: 15,
    estimatedCalories: [40, 70],
    exercises: [
      ["childs-pose", { mode: "time", durationSec: 45, sets: 1, restSec: 5 }],
      ["hamstring-stretch", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
      ["hip-flexor-stretch", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
      ["chest-stretch", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
      ["cobra-stretch", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
      ["downward-dog", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
    ],
  }),
  make({
    id: "lower-back-reset",
    name: "Lower Back Reset",
    description: "Gentle decompression and core re-engagement for cranky backs.",
    goal: "recovery",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    estimatedCalories: [35, 65],
    exercises: [
      ["childs-pose", { mode: "time", durationSec: 45, sets: 1, restSec: 5 }],
      ["cat-cow", { mode: "time", durationSec: 45, sets: 1, restSec: 5 }],
      ["bird-dog", { mode: "time", durationSec: 40, sets: 2, restSec: 10 }],
      ["glute-bridge", { mode: "reps", reps: 12, sets: 2, restSec: 15 }],
      ["cobra-stretch", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
    ],
  }),
  make({
    id: "hip-opener",
    name: "Hip Opener Routine",
    description: "Target tight hips and hip flexors with focused mobility.",
    goal: "mobility",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    estimatedCalories: [35, 65],
    exercises: [
      ["hip-circle", { mode: "time", durationSec: 40, sets: 1, restSec: 5 }],
      ["worlds-greatest-stretch", { mode: "time", durationSec: 45, sets: 1, restSec: 5 }],
      ["hip-flexor-stretch", { mode: "time", durationSec: 45, sets: 1, restSec: 5 }],
      ["childs-pose", { mode: "time", durationSec: 45, sets: 1, restSec: 5 }],
    ],
  }),
]

/** Lookup across predefined templates (custom handled in app state). */
export function getPredefinedTemplate(id: string): WorkoutTemplate | undefined {
  return PREDEFINED_TEMPLATES.find((t) => t.id === id)
}
