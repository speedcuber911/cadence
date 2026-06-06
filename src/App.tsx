import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  Dumbbell,
  History as HistoryIcon,
  LayoutDashboard,
  LineChart,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  clearAllData as clearAllStorage,
  exportAllDataJson,
  importAllData,
  loadCustomTemplates,
  loadHistory,
  loadLastGoal,
  loadSettings,
  saveCustomTemplates,
  saveHistory,
  saveLastGoal,
  saveSettings,
} from "@/lib/storage"
import { PREDEFINED_TEMPLATES } from "@/lib/templates"
import { applyScaling } from "@/lib/template"
import type { AppApi, ScreenName } from "@/lib/appState"
import type {
  Goal,
  TimeAvailable,
  UserSettings,
  WorkoutSession,
  WorkoutTemplate,
} from "@/types"

import Dashboard from "@/components/screens/Dashboard"
import WorkoutLibrary from "@/components/screens/WorkoutLibrary"
import WorkoutDetail from "@/components/screens/WorkoutDetail"
import WorkoutPlayer from "@/components/screens/WorkoutPlayer"
import WorkoutBuilder from "@/components/screens/WorkoutBuilder"
import History from "@/components/screens/History"
import ProgressDashboard from "@/components/screens/ProgressDashboard"
import Settings from "@/components/screens/Settings"

interface BuilderState {
  templateId?: string
  mode: "edit" | "duplicate" | "new"
}

interface PlayerState {
  template: WorkoutTemplate
}

const NAV: Array<{ key: ScreenName; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "library", label: "Library", icon: Dumbbell },
  { key: "builder", label: "Build", icon: Plus },
  { key: "history", label: "History", icon: HistoryIcon },
  { key: "progress", label: "Progress", icon: LineChart },
  { key: "settings", label: "Settings", icon: SettingsIcon },
]

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings())
  const [customTemplates, setCustomTemplates] = useState<WorkoutTemplate[]>(() =>
    loadCustomTemplates(),
  )
  const [history, setHistory] = useState<WorkoutSession[]>(() => loadHistory())
  const [lastGoal, setLastGoalState] = useState<Goal>(() => loadLastGoal())
  const [timeAvailable, setTimeAvailable] = useState<TimeAvailable>(30)

  const [screen, setScreen] = useState<ScreenName>("dashboard")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [builder, setBuilder] = useState<BuilderState | null>(null)
  const [player, setPlayer] = useState<PlayerState | null>(null)

  // Persist on change.
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveCustomTemplates(customTemplates), [customTemplates])
  useEffect(() => saveHistory(history), [history])
  useEffect(() => saveLastGoal(lastGoal), [lastGoal])

  const templates = useMemo<WorkoutTemplate[]>(
    () => [...PREDEFINED_TEMPLATES, ...customTemplates],
    [customTemplates],
  )

  const getTemplate = useCallback(
    (id: string) => templates.find((t) => t.id === id),
    [templates],
  )

  const navigate = useCallback((s: ScreenName) => setScreen(s), [])

  const openDetail = useCallback((templateId: string) => {
    setDetailId(templateId)
    setScreen("detail")
  }, [])

  const startWorkout = useCallback<AppApi["startWorkout"]>(
    (templateId, scaling = "standard") => {
      const base = templates.find((t) => t.id === templateId)
      if (!base) return
      const scaled = scaling === "standard" ? base : applyScaling(base, scaling)
      setPlayer({ template: scaled })
      setScreen("player")
    },
    [templates],
  )

  const openBuilder = useCallback<AppApi["openBuilder"]>(
    (templateId, mode = "new") => {
      setBuilder({ templateId, mode })
      setScreen("builder")
    },
    [],
  )

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const saveCustomTemplate = useCallback((t: WorkoutTemplate) => {
    setCustomTemplates((prev) => {
      const i = prev.findIndex((x) => x.id === t.id)
      const next = { ...t, isCustom: true, updatedAt: new Date().toISOString() }
      if (i >= 0) {
        const copy = prev.slice()
        copy[i] = next
        return copy
      }
      return [...prev, next]
    })
  }, [])

  const deleteCustomTemplate = useCallback((id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const saveSession = useCallback((s: WorkoutSession) => {
    setHistory((prev) => [s, ...prev])
  }, [])

  const deleteSession = useCallback((id: string) => {
    setHistory((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const setLastGoal = useCallback((g: Goal) => setLastGoalState(g), [])

  const importData = useCallback((json: string) => {
    const res = importAllData(json)
    if (!res.ok) return { ok: false, error: res.error }
    setSettings(res.data.settings)
    setCustomTemplates(res.data.customTemplates)
    setHistory(res.data.history)
    setLastGoalState(res.data.lastGoal)
    return { ok: true }
  }, [])

  const exportData = useCallback(() => exportAllDataJson(), [])

  const clearAllData = useCallback(() => {
    clearAllStorage()
    setSettings(loadSettings())
    setCustomTemplates([])
    setHistory([])
    setLastGoalState("general_fitness")
  }, [])

  const app: AppApi = {
    settings,
    templates,
    customTemplates,
    history,
    lastGoal,
    timeAvailable,
    navigate,
    openDetail,
    startWorkout,
    openBuilder,
    updateSettings,
    saveCustomTemplate,
    deleteCustomTemplate,
    saveSession,
    deleteSession,
    setLastGoal,
    setTimeAvailable,
    importData,
    exportData,
    clearAllData,
    getTemplate,
  }

  // The player is full-screen and chromeless (no nav rail).
  if (screen === "player" && player) {
    return (
      <WorkoutPlayer
        app={app}
        template={player.template}
        onExit={() => {
          setPlayer(null)
          setScreen("dashboard")
        }}
      />
    )
  }

  const detailTemplate = detailId ? getTemplate(detailId) : undefined

  return (
    <div className="min-h-svh">
      <div className="mx-auto flex min-h-svh max-w-[1400px] flex-col lg:flex-row">
        {/* Side nav (desktop) / bottom bar (mobile) */}
        <NavRail current={screen} onNavigate={navigate} userName={settings.name} />

        <main className="flex-1 px-4 pb-24 pt-6 lg:px-10 lg:pb-10">
          {screen === "dashboard" && <Dashboard app={app} />}
          {screen === "library" && <WorkoutLibrary app={app} />}
          {screen === "detail" && detailTemplate && (
            <WorkoutDetail app={app} template={detailTemplate} />
          )}
          {screen === "detail" && !detailTemplate && (
            <EmptyDetail onBack={() => navigate("library")} />
          )}
          {screen === "builder" && (
            <WorkoutBuilder
              app={app}
              editTemplateId={builder?.templateId}
              mode={builder?.mode ?? "new"}
            />
          )}
          {screen === "history" && <History app={app} />}
          {screen === "progress" && <ProgressDashboard app={app} />}
          {screen === "settings" && <Settings app={app} />}
        </main>
      </div>
    </div>
  )
}

function NavRail({
  current,
  onNavigate,
  userName,
}: {
  current: ScreenName
  onNavigate: (s: ScreenName) => void
  userName: string
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border/60 px-5 py-7 lg:flex">
        <div className="mb-10 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground glow-cta">
            <Activity className="size-5" strokeWidth={2.75} />
          </div>
          <div className="min-w-0 leading-none">
            <div className="font-display text-xl uppercase tracking-tight">Workout</div>
            <div className="font-display text-xl uppercase tracking-tight text-primary">
              Companion
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = current === key
            return (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--brand)/0.7)]" />
                )}
                <Icon
                  className={cn("size-[18px]", active && "text-primary")}
                  strokeWidth={active ? 2.5 : 2}
                />
                {label}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-border/60 pt-4 text-xs font-medium text-muted-foreground">
          {userName ? (
            <span>
              Athlete: <span className="text-foreground">{userName}</span>
            </span>
          ) : (
            "Set your name in Settings"
          )}
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border/60 bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
        {NAV.map(({ key, label, icon: Icon }) => {
          const active = current === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </button>
          )
        })}
      </nav>
    </>
  )
}

function EmptyDetail({ onBack }: { onBack: () => void }) {
  return (
    <div className="grid min-h-[60svh] place-items-center text-center">
      <div>
        <p className="text-lg font-semibold">Workout not found</p>
        <button
          onClick={onBack}
          className="mt-3 text-sm font-semibold text-muted-foreground underline"
        >
          Back to library
        </button>
      </div>
    </div>
  )
}
