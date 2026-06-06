// Shared app-state contract consumed by every screen. App.tsx owns the actual
// React state and implements these actions; screens receive `AppApi` via props.
import type {
  Goal,
  TimeAvailable,
  UserSettings,
  WorkoutSession,
  WorkoutTemplate,
} from "@/types"

export type ScreenName =
  | "dashboard"
  | "library"
  | "detail"
  | "player"
  | "builder"
  | "history"
  | "progress"
  | "settings"

/** Read-only state slice handed to screens. */
export interface AppState {
  settings: UserSettings
  /** Predefined + custom, merged. Predefined first. */
  templates: WorkoutTemplate[]
  customTemplates: WorkoutTemplate[]
  history: WorkoutSession[]
  lastGoal: Goal
  timeAvailable: TimeAvailable
}

/** Actions screens can call to drive the app. */
export interface AppActions {
  navigate(screen: ScreenName): void
  /** Open the detail screen for a template id. */
  openDetail(templateId: string): void
  /** Start the guided player for a template (optionally pre-scaled). */
  startWorkout(templateId: string, scaling?: "easier" | "standard" | "harder"): void
  /** Open the builder; pass a template id to edit/duplicate, or omit for new. */
  openBuilder(templateId?: string, mode?: "edit" | "duplicate" | "new"): void

  updateSettings(patch: Partial<UserSettings>): void
  saveCustomTemplate(t: WorkoutTemplate): void
  deleteCustomTemplate(id: string): void
  saveSession(s: WorkoutSession): void
  deleteSession(id: string): void
  setLastGoal(g: Goal): void
  setTimeAvailable(t: TimeAvailable): void

  importData(json: string): { ok: boolean; error?: string }
  exportData(): string
  clearAllData(): void

  getTemplate(id: string): WorkoutTemplate | undefined
}

export type AppApi = AppState & AppActions
