// ===========================================================================
// localStorage persistence layer. SSR/try-catch safe.
// ===========================================================================

import type {
  AppData,
  Goal,
  UserSettings,
  WorkoutSession,
  WorkoutTemplate,
} from "@/types"

const KEY_SETTINGS = "workoutCompanion.settings.v1"
const KEY_CUSTOM_TEMPLATES = "workoutCompanion.customTemplates.v1"
const KEY_HISTORY = "workoutCompanion.history.v1"
const KEY_LAST_GOAL = "workoutCompanion.lastGoal.v1"

export const DEFAULT_SETTINGS: UserSettings = {
  name: "",
  goal: "general_fitness",
  fitnessLevel: "Beginner",
  defaultDurationMin: 30,
  soundEnabled: true,
  volume: 0.4,
  defaultRestSec: 20,
  units: "metric",
  bodyweightKg: 75,
  preferredStyle: "mixed",
}

const VALID_GOALS: Goal[] = [
  "fat_loss",
  "strength",
  "general_fitness",
  "mobility",
  "recovery",
]

// ---------------------------------------------------------------------------
// Low-level helpers (SSR safe)
// ---------------------------------------------------------------------------

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

function readRaw(key: string): string | null {
  if (!hasStorage()) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): void {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // quota / private mode — ignore
  }
}

function removeRaw(key: string): void {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function parseJson<T>(raw: string | null): T | null {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function loadSettings(): UserSettings {
  const parsed = parseJson<unknown>(readRaw(KEY_SETTINGS))
  if (!isObject(parsed)) return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...(parsed as Partial<UserSettings>) }
}

export function saveSettings(s: UserSettings): void {
  writeRaw(KEY_SETTINGS, JSON.stringify(s))
}

// ---------------------------------------------------------------------------
// Custom templates
// ---------------------------------------------------------------------------

export function loadCustomTemplates(): WorkoutTemplate[] {
  const parsed = parseJson<unknown>(readRaw(KEY_CUSTOM_TEMPLATES))
  return Array.isArray(parsed) ? (parsed as WorkoutTemplate[]) : []
}

export function saveCustomTemplates(t: WorkoutTemplate[]): void {
  writeRaw(KEY_CUSTOM_TEMPLATES, JSON.stringify(t))
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function loadHistory(): WorkoutSession[] {
  const parsed = parseJson<unknown>(readRaw(KEY_HISTORY))
  return Array.isArray(parsed) ? (parsed as WorkoutSession[]) : []
}

export function saveHistory(h: WorkoutSession[]): void {
  writeRaw(KEY_HISTORY, JSON.stringify(h))
}

// ---------------------------------------------------------------------------
// Last goal
// ---------------------------------------------------------------------------

export function loadLastGoal(): Goal {
  const parsed = parseJson<unknown>(readRaw(KEY_LAST_GOAL))
  if (typeof parsed === "string" && (VALID_GOALS as string[]).includes(parsed)) {
    return parsed as Goal
  }
  return DEFAULT_SETTINGS.goal
}

export function saveLastGoal(g: Goal): void {
  writeRaw(KEY_LAST_GOAL, JSON.stringify(g))
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

export function exportAllData(): AppData {
  return {
    version: 1,
    settings: loadSettings(),
    customTemplates: loadCustomTemplates(),
    history: loadHistory(),
    lastGoal: loadLastGoal(),
  }
}

export function exportAllDataJson(): string {
  return JSON.stringify(exportAllData(), null, 2)
}

function isValidAppData(v: unknown): v is AppData {
  if (!isObject(v)) return false
  if (typeof v.version !== "number") return false
  if (!isObject(v.settings)) return false
  if (!Array.isArray(v.customTemplates)) return false
  if (!Array.isArray(v.history)) return false
  if (typeof v.lastGoal !== "string") return false
  return true
}

export function importAllData(
  json: string,
): { ok: true; data: AppData } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: "Invalid JSON: could not parse the provided data." }
  }

  if (!isValidAppData(parsed)) {
    return {
      ok: false,
      error:
        "Invalid data shape: expected an object with version, settings, customTemplates, history, and lastGoal.",
    }
  }

  const data: AppData = {
    version: parsed.version,
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    customTemplates: parsed.customTemplates,
    history: parsed.history,
    lastGoal: (VALID_GOALS as string[]).includes(parsed.lastGoal)
      ? parsed.lastGoal
      : DEFAULT_SETTINGS.goal,
  }

  saveSettings(data.settings)
  saveCustomTemplates(data.customTemplates)
  saveHistory(data.history)
  saveLastGoal(data.lastGoal)

  return { ok: true, data }
}

export function clearAllData(): void {
  removeRaw(KEY_SETTINGS)
  removeRaw(KEY_CUSTOM_TEMPLATES)
  removeRaw(KEY_HISTORY)
  removeRaw(KEY_LAST_GOAL)
}
