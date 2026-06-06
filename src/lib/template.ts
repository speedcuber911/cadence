// ===========================================================================
// Pure helpers operating on templates/blocks. NEVER mutate predefined inputs.
// ===========================================================================

import { getExercise } from "@/data/exercises"
import type {
  MuscleGroup,
  PlayerSegment,
  ScalingOption,
  WorkoutBlock,
  WorkoutTemplate,
} from "@/types"

/** Approximate seconds per rep used when estimating rep-mode work. */
const SECONDS_PER_REP = 3
/** Default prep countdown at the very start of a player session. */
const PREP_SECONDS = 10

const MIN_REPS = 1
const MIN_DURATION_SEC = 5
const MIN_REST_SEC = 0

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Total estimated active+rest seconds for a template.
 * time mode: durationSec * sets; rep mode: reps * SECONDS_PER_REP * sets.
 * Plus restSec for each set.
 */
export function templateDurationSec(t: WorkoutTemplate): number {
  let total = 0
  for (const block of t.blocks) {
    const workPerSet =
      block.mode === "time" ? block.durationSec : block.reps * SECONDS_PER_REP
    total += workPerSet * block.sets
    total += block.restSec * block.sets
  }
  return total
}

/** Unique primary muscles across the template's exercises. */
export function templateMuscleGroups(t: WorkoutTemplate): MuscleGroup[] {
  const seen = new Set<MuscleGroup>()
  const out: MuscleGroup[] = []
  for (const block of t.blocks) {
    const ex = getExercise(block.exerciseId)
    if (!ex) continue
    for (const m of ex.primaryMuscles) {
      if (!seen.has(m)) {
        seen.add(m)
        out.push(m)
      }
    }
  }
  return out
}

/**
 * Returns a NEW template with blocks scaled. Does not persist or mutate input.
 * easier  = reps*0.7, duration*0.8, +5s rest
 * harder  = reps*1.2, duration*1.2, -5s rest
 * standard = unchanged
 */
export function applyScaling(
  t: WorkoutTemplate,
  scaling: ScalingOption,
): WorkoutTemplate {
  const clone = deepClone(t)
  if (scaling === "standard") return clone

  const repFactor = scaling === "easier" ? 0.7 : 1.2
  const durationFactor = scaling === "easier" ? 0.8 : 1.2
  const restDelta = scaling === "easier" ? 5 : -5

  clone.blocks = clone.blocks.map((block) => ({
    ...block,
    reps: Math.max(MIN_REPS, Math.round(block.reps * repFactor)),
    durationSec: Math.max(
      MIN_DURATION_SEC,
      Math.round(block.durationSec * durationFactor),
    ),
    restSec: Math.max(MIN_REST_SEC, Math.round(block.restSec + restDelta)),
  }))

  return clone
}

/**
 * Flatten a template into runtime PlayerSegments.
 * Adds a single PREP segment up front, WORK segments per set, and a REST
 * segment after each set except the final rest of the final block.
 */
export function buildPlayerSegments(t: WorkoutTemplate): PlayerSegment[] {
  const segments: PlayerSegment[] = []
  const blocks = t.blocks

  // Resolve distinct exercise names in block order (for nextExerciseName).
  const blockNames: string[] = blocks.map((b) => {
    const ex = getExercise(b.exerciseId)
    return ex?.name ?? "Exercise"
  })

  function nextDistinctName(fromBlockIndex: number, currentName: string): string | null {
    for (let i = fromBlockIndex; i < blockNames.length; i++) {
      if (blockNames[i] !== currentName) return blockNames[i]
    }
    return null
  }

  // PREP segment.
  if (blocks.length > 0) {
    const first = blocks[0]
    const firstEx = getExercise(first.exerciseId)
    segments.push({
      id: crypto.randomUUID(),
      blockId: first.id,
      exerciseId: first.exerciseId,
      exerciseName: "Get ready",
      type: "PREP",
      mode: first.mode,
      setNumber: 0,
      totalSets: first.sets,
      durationSec: PREP_SECONDS,
      targetReps: 0,
      perSide: firstEx?.perSide ?? false,
      instruction: "Get ready",
      tip: firstEx?.techniqueTips[0] ?? "",
      illustration: firstEx?.illustration ?? "",
      nextExerciseName: firstEx?.name ?? null,
    })
  }

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]
    const ex = getExercise(block.exerciseId)
    const exName = blockNames[bi]
    const isLastBlock = bi === blocks.length - 1
    const nextName = nextDistinctName(bi + 1, exName)

    for (let setIdx = 0; setIdx < block.sets; setIdx++) {
      const setNumber = setIdx + 1
      const isLastSet = setIdx === block.sets - 1

      segments.push({
        id: crypto.randomUUID(),
        blockId: block.id,
        exerciseId: block.exerciseId,
        exerciseName: exName,
        type: "WORK",
        mode: block.mode,
        setNumber,
        totalSets: block.sets,
        durationSec: block.mode === "time" ? block.durationSec : 0,
        targetReps: block.mode === "reps" ? block.reps : 0,
        perSide: ex?.perSide ?? false,
        instruction: block.note ?? ex?.techniqueTips[0] ?? "",
        tip: ex?.techniqueTips[0] ?? "",
        illustration: ex?.illustration ?? "",
        nextExerciseName: nextName,
      })

      // REST after each set except the final rest of the final block.
      const isFinalRestOfWorkout = isLastBlock && isLastSet
      if (block.restSec > 0 && !isFinalRestOfWorkout) {
        // After the last set of a block, the "next" is the next exercise.
        const restNext = isLastSet ? nextName : exName
        segments.push({
          id: crypto.randomUUID(),
          blockId: block.id,
          exerciseId: block.exerciseId,
          exerciseName: "Rest",
          type: "REST",
          mode: block.mode,
          setNumber,
          totalSets: block.sets,
          durationSec: block.restSec,
          targetReps: 0,
          perSide: false,
          instruction: "Rest",
          tip: "",
          illustration: ex?.illustration ?? "",
          nextExerciseName: restNext,
        })
      }
    }
  }

  return segments
}

/** Deep clone with new ids, marked custom, fresh timestamps. */
export function duplicateTemplate(
  t: WorkoutTemplate,
  newName?: string,
): WorkoutTemplate {
  const clone = deepClone(t)
  const now = new Date().toISOString()
  clone.id = crypto.randomUUID()
  clone.name = newName ?? `${t.name} (copy)`
  clone.isCustom = true
  clone.createdAt = now
  clone.updatedAt = now
  clone.blocks = clone.blocks.map((b) => ({ ...b, id: crypto.randomUUID() }))
  return clone
}

/** A blank custom template with sane defaults. */
export function createEmptyTemplate(): WorkoutTemplate {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: "New Workout",
    description: "",
    goal: "general_fitness",
    difficulty: "Beginner",
    estimatedMinutes: 0,
    equipment: ["None"],
    muscleGroups: [],
    estimatedCalories: [0, 0],
    blocks: [] as WorkoutBlock[],
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  }
}
