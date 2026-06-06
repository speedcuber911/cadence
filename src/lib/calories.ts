// ===========================================================================
// MET-based calorie estimation.
// kcal = MET * 3.5 * kg / 200 * minutes
// ===========================================================================

import type { Difficulty, WorkoutTemplate } from "@/types"

type Intensity = "low" | "moderate" | "high"

const MET: Record<Intensity, number> = {
  low: 3.5,
  moderate: 6,
  high: 8,
}

export function difficultyToIntensity(d: Difficulty): Intensity {
  switch (d) {
    case "Beginner":
      return "low"
    case "Intermediate":
      return "moderate"
    case "Advanced":
      return "high"
  }
}

export function estimateSessionCalories(
  durationSec: number,
  intensity: Intensity,
  bodyweightKg: number,
): number {
  const minutes = Math.max(0, durationSec) / 60
  const met = MET[intensity]
  const kcal = (met * 3.5 * bodyweightKg) / 200 * minutes
  return Math.round(kcal)
}

export function estimateTemplateCalorieRange(
  template: WorkoutTemplate,
  bodyweightKg: number,
): [number, number] {
  // Derive minutes from blocks: time-mode = duration*sets, rep-mode ~3s/rep*sets,
  // plus rest between sets.
  let totalSec = 0
  for (const block of template.blocks) {
    const workPerSet =
      block.mode === "time" ? block.durationSec : block.reps * 3
    totalSec += workPerSet * block.sets
    totalSec += block.restSec * block.sets
  }

  const low = estimateSessionCalories(totalSec, "low", bodyweightKg)
  const high = estimateSessionCalories(totalSec, "high", bodyweightKg)
  return [low, high]
}
