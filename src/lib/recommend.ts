// ===========================================================================
// Rules-based workout suggestion engine. Pure, robust to empty inputs.
// ===========================================================================

import type {
  Goal,
  MuscleGroup,
  Recommendation,
  TimeAvailable,
  WorkoutSession,
  WorkoutTemplate,
} from "@/types"

const DAY_MS = 24 * 60 * 60 * 1000

const LEG_MUSCLES: MuscleGroup[] = ["quads", "hamstrings", "glutes"]

export interface HistorySummary {
  /** Most recent session, or null. */
  lastSession: WorkoutSession | null
  /** Whole days since the last session (Infinity if none). */
  daysSinceLast: number
  /** Number of sessions in the trailing 7 days. */
  sessionsThisWeek: number
  /** True if legs were trained hard (Intermediate+) in last 48h. */
  legsTrainedRecentlyHard: boolean
  /** Distinct primary muscle groups trained in the last 7 days. */
  recentMuscles: Set<MuscleGroup>
}

export function summarizeHistory(
  history: WorkoutSession[],
  now: Date = new Date(),
): HistorySummary {
  const nowMs = now.getTime()
  const sorted = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  )

  const lastSession = sorted[0] ?? null
  const daysSinceLast = lastSession
    ? Math.floor((nowMs - new Date(lastSession.completedAt).getTime()) / DAY_MS)
    : Number.POSITIVE_INFINITY

  let sessionsThisWeek = 0
  let legsTrainedRecentlyHard = false
  const recentMuscles = new Set<MuscleGroup>()

  for (const s of sorted) {
    const ts = new Date(s.completedAt).getTime()
    const ageMs = nowMs - ts
    if (ageMs <= 7 * DAY_MS) {
      sessionsThisWeek++
      for (const m of s.muscleGroups) recentMuscles.add(m)
    }
    if (ageMs <= 2 * DAY_MS) {
      const trainedLegs = s.muscleGroups.some((m) => LEG_MUSCLES.includes(m))
      const hard = s.difficulty === "Intermediate" || s.difficulty === "Advanced"
      if (trainedLegs && hard) legsTrainedRecentlyHard = true
    }
  }

  return {
    lastSession,
    daysSinceLast,
    sessionsThisWeek,
    legsTrainedRecentlyHard,
    recentMuscles,
  }
}

// ---------------------------------------------------------------------------
// Template selection helpers
// ---------------------------------------------------------------------------

function templateHasLegs(t: WorkoutTemplate): boolean {
  return t.muscleGroups.some((m) => LEG_MUSCLES.includes(m))
}

/**
 * Score a template against desired goals, time, and difficulty preferences.
 * Higher is better.
 */
function scoreTemplate(
  t: WorkoutTemplate,
  opts: {
    goals: Goal[]
    timeAvailable: number
    avoidLegs?: boolean
    preferGoals?: Goal[]
    leastRecentMuscles?: Set<MuscleGroup>
  },
): number {
  let score = 0

  if (opts.goals.includes(t.goal)) score += 40
  if (opts.preferGoals?.includes(t.goal)) score += 15

  // Time fit: within +5 min is ideal, penalize being over budget more.
  const over = t.estimatedMinutes - opts.timeAvailable
  if (over <= 5) {
    score += 25 - Math.abs(over) // closer to the budget scores higher
  } else {
    score -= over * 2
  }

  if (opts.avoidLegs && templateHasLegs(t)) score -= 30

  if (opts.leastRecentMuscles && opts.leastRecentMuscles.size > 0) {
    const fresh = t.muscleGroups.filter((m) =>
      opts.leastRecentMuscles!.has(m),
    ).length
    score += fresh * 5
  }

  return score
}

function pickBest(
  templates: WorkoutTemplate[],
  opts: Parameters<typeof scoreTemplate>[1],
): WorkoutTemplate | null {
  if (templates.length === 0) return null

  // Prefer templates within time budget (+5). Fall back to all.
  const withinBudget = templates.filter(
    (t) => t.estimatedMinutes <= opts.timeAvailable + 5,
  )
  const pool = withinBudget.length > 0 ? withinBudget : templates

  let best: WorkoutTemplate | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const t of pool) {
    const s = scoreTemplate(t, opts)
    if (s > bestScore) {
      bestScore = s
      best = t
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function recommendWorkout(opts: {
  templates: WorkoutTemplate[]
  history: WorkoutSession[]
  goal: Goal
  timeAvailable: TimeAvailable
  now?: Date
}): Recommendation {
  const { templates, history, goal, timeAvailable } = opts
  const now = opts.now ?? new Date()

  if (templates.length === 0) {
    return {
      templateId: "",
      reason:
        "No workout templates are available yet. Create one to get a personalized recommendation.",
      tag: "Suggested",
    }
  }

  const summary = summarizeHistory(history, now)
  const last = summary.lastSession

  // Rule 1: No workout in 3+ days (or empty history) -> beginner full-body restart.
  if (summary.daysSinceLast >= 3) {
    const pick = pickBest(templates, {
      goals: ["general_fitness"],
      preferGoals: [goal],
      timeAvailable,
    })
    const gap =
      summary.daysSinceLast === Number.POSITIVE_INFINITY
        ? "you haven't logged a workout yet"
        : `it's been ${summary.daysSinceLast} days since your last workout`
    return {
      templateId: pick?.id ?? templates[0].id,
      reason: `Suggested because ${gap} — easing back in with a balanced full-body session.`,
      tag: "Restart",
    }
  }

  // Rule 2: Trained 5+ days this week -> recovery/mobility.
  if (summary.sessionsThisWeek >= 5) {
    const pick = pickBest(templates, {
      goals: ["recovery", "mobility"],
      preferGoals: ["recovery", "mobility"],
      timeAvailable,
    })
    return {
      templateId: pick?.id ?? templates[0].id,
      reason: `Suggested because you've trained ${summary.sessionsThisWeek} days this week — a recovery and mobility session will help you bounce back.`,
      tag: "Recovery",
    }
  }

  // Rule 3: Last workout RPE>=8 OR feel "brutal" -> mobility / low-intensity.
  if (last && ((last.rpe ?? 0) >= 8 || last.feel === "brutal")) {
    const pick = pickBest(templates, {
      goals: ["mobility", "recovery"],
      preferGoals: ["mobility", "recovery"],
      timeAvailable,
    })
    const why =
      last.feel === "brutal"
        ? "your last workout felt brutal"
        : "your last workout was high intensity"
    return {
      templateId: pick?.id ?? templates[0].id,
      reason: `Suggested because ${why} — a lower-intensity mobility session will aid recovery.`,
      tag: "Recovery",
    }
  }

  // Rule 4: Legs trained hard in last 48h -> avoid intense lower body.
  if (summary.legsTrainedRecentlyHard) {
    const pick = pickBest(templates, {
      goals: ["general_fitness", "strength", "fat_loss"],
      preferGoals: [goal],
      timeAvailable,
      avoidLegs: true,
    })
    return {
      templateId: pick?.id ?? templates[0].id,
      reason:
        "Suggested because your legs were trained hard recently — focusing on upper body, core, and conditioning to let them recover.",
      tag: "Balance",
    }
  }

  // Rule 5: timeAvailable <= 10 -> quick sweat or mobility.
  if (timeAvailable <= 10) {
    const pick = pickBest(templates, {
      goals: ["fat_loss", "mobility", "general_fitness"],
      preferGoals: [goal],
      timeAvailable,
    })
    return {
      templateId: pick?.id ?? templates[0].id,
      reason: `Suggested because you have ${timeAvailable} minutes — a quick, efficient session to keep your streak going.`,
      tag: "Quick",
    }
  }

  // Rule 6: goal fat_loss & fresh -> conditioning/HIIT.
  if (goal === "fat_loss") {
    const pick = pickBest(templates, {
      goals: ["fat_loss"],
      preferGoals: ["fat_loss"],
      timeAvailable,
    })
    return {
      templateId: pick?.id ?? templates[0].id,
      reason:
        "Suggested because you're fresh and aiming for fat loss — a conditioning session to maximize calorie burn.",
      tag: "Conditioning",
    }
  }

  // Rule 7: goal strength -> rotate based on least-recently-trained muscles.
  if (goal === "strength") {
    // Muscle groups NOT trained in the last 7 days are the freshest targets.
    const allMuscles: MuscleGroup[] = [
      "chest",
      "shoulders",
      "triceps",
      "biceps",
      "back",
      "core",
      "quads",
      "hamstrings",
      "glutes",
    ]
    const leastRecent = new Set<MuscleGroup>(
      allMuscles.filter((m) => !summary.recentMuscles.has(m)),
    )
    const pick = pickBest(templates, {
      goals: ["strength"],
      preferGoals: ["strength"],
      timeAvailable,
      leastRecentMuscles: leastRecent,
    })
    return {
      templateId: pick?.id ?? templates[0].id,
      reason:
        "Suggested because you're building strength — rotating to the muscle groups you've trained least recently.",
      tag: "Strength",
    }
  }

  // Rule 8: general fitness pick matching goal & time.
  const pick = pickBest(templates, {
    goals: [goal],
    preferGoals: [goal],
    timeAvailable,
  })
  return {
    templateId: pick?.id ?? templates[0].id,
    reason: `Suggested to match your ${goal.replace("_", " ")} goal and your available ${timeAvailable} minutes.`,
    tag: "Suggested",
  }
}
