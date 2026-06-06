import { useRef, useState } from "react"
import {
  AlertTriangle,
  Download,
  Target,
  Trash2,
  Upload,
  User,
  Volume2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { AppApi } from "@/lib/appState"
import type {
  Difficulty,
  Goal,
  Units,
  WorkoutStyle,
} from "@/types"

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const GOAL_LABEL: Record<Goal, string> = {
  fat_loss: "Fat loss",
  strength: "Strength",
  general_fitness: "General fitness",
  mobility: "Mobility",
  recovery: "Recovery",
}

const GOAL_ORDER: Goal[] = [
  "general_fitness",
  "fat_loss",
  "strength",
  "mobility",
  "recovery",
]

const LEVEL_ORDER: Difficulty[] = ["Beginner", "Intermediate", "Advanced"]

const STYLE_LABEL: Record<WorkoutStyle, string> = {
  strength: "Strength",
  hiit: "HIIT",
  low_impact: "Low impact",
  mobility: "Mobility",
  mixed: "Mixed",
}

const STYLE_ORDER: WorkoutStyle[] = [
  "mixed",
  "strength",
  "hiit",
  "low_impact",
  "mobility",
]

const DURATION_OPTIONS = [10, 15, 20, 30, 45]
const REST_OPTIONS = [10, 15, 20, 30, 45, 60]

const KG_PER_LB = 1 / 2.2046

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="accent-bar !h-4 !w-1" />
      <h2 className="eyebrow flex items-center gap-2">
        {Icon ? <Icon className="size-3.5 text-primary" /> : null}
        {children}
      </h2>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-6">
      <div className="space-y-1">
        <Label
          htmlFor={htmlFor}
          className="text-sm font-display uppercase tracking-wide"
        >
          {label}
        </Label>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="sm:justify-self-end sm:w-full">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings screen
// ---------------------------------------------------------------------------

export default function Settings({ app }: { app: AppApi }) {
  const { settings } = app
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [dataMessage, setDataMessage] = useState<{
    kind: "success" | "error"
    text: string
  } | null>(null)

  const isImperial = settings.units === "imperial"

  // ----- weight display/conversion -----
  const displayWeight = isImperial
    ? Math.round(settings.bodyweightKg * 2.2046)
    : Math.round(settings.bodyweightKg)

  function handleWeightChange(raw: string) {
    const n = Number(raw)
    if (Number.isNaN(n) || n <= 0) return
    const kg = isImperial ? n * KG_PER_LB : n
    app.updateSettings({ bodyweightKg: kg })
  }

  // ----- export -----
  function handleExport() {
    try {
      const json = app.exportData()
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `workout-companion-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDataMessage({ kind: "success", text: "Data exported successfully." })
    } catch {
      setDataMessage({ kind: "error", text: "Could not export data." })
    }
  }

  // ----- import -----
  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file again re-fires onChange.
    e.target.value = ""
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : ""
      setPendingImport(text)
      setImportDialogOpen(true)
    }
    reader.onerror = () => {
      setDataMessage({ kind: "error", text: "Could not read the selected file." })
    }
    reader.readAsText(file)
  }

  function confirmImport() {
    if (pendingImport === null) return
    const result = app.importData(pendingImport)
    if (result.ok) {
      setDataMessage({ kind: "success", text: "Data imported successfully." })
    } else {
      setDataMessage({
        kind: "error",
        text: result.error ?? "Import failed: the data could not be read.",
      })
    }
    setImportDialogOpen(false)
    setPendingImport(null)
  }

  // ----- clear -----
  function confirmClear() {
    app.clearAllData()
    setClearDialogOpen(false)
    setDataMessage({ kind: "success", text: "All data has been cleared." })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="eyebrow text-primary">Your setup</p>
        <h1 className="mt-2 font-display text-5xl uppercase leading-[0.85] sm:text-6xl">
          Settings
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Personalize your profile and workout defaults. Changes save
          automatically.
        </p>
      </header>

      <div className="mt-10 space-y-8">
        {/* ----------------------------------------------------------------- */}
        {/* Profile */}
        {/* ----------------------------------------------------------------- */}
        <section className="space-y-4">
          <SectionTitle icon={User}>Profile</SectionTitle>
          <div className="surface space-y-6 p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              Who you are and what you&apos;re training for.
            </p>
            <Field label="Name" htmlFor="settings-name">
              <Input
                id="settings-name"
                value={settings.name}
                placeholder="Your name"
                onChange={(e) => app.updateSettings({ name: e.target.value })}
              />
            </Field>

            <Field label="Primary goal">
              <Select
                value={settings.goal}
                onValueChange={(v) => app.updateSettings({ goal: v as Goal })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_ORDER.map((g) => (
                    <SelectItem key={g} value={g}>
                      {GOAL_LABEL[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fitness level">
              <Select
                value={settings.fitnessLevel}
                onValueChange={(v) =>
                  app.updateSettings({ fitnessLevel: v as Difficulty })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_ORDER.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Workout preferences */}
        {/* ----------------------------------------------------------------- */}
        <section className="space-y-4">
          <SectionTitle icon={Target}>Workout preferences</SectionTitle>
          <div className="surface space-y-6 p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              Defaults used when building and recommending workouts.
            </p>
            <Field label="Default workout duration">
              <Select
                value={String(settings.defaultDurationMin)}
                onValueChange={(v) =>
                  app.updateSettings({ defaultDurationMin: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Rest between sets">
              <Select
                value={String(settings.defaultRestSec)}
                onValueChange={(v) =>
                  app.updateSettings({ defaultRestSec: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REST_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s} sec
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Preferred workout style">
              <Select
                value={settings.preferredStyle}
                onValueChange={(v) =>
                  app.updateSettings({ preferredStyle: v as WorkoutStyle })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STYLE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Units">
              <Select
                value={settings.units}
                onValueChange={(v) => app.updateSettings({ units: v as Units })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric (kg)</SelectItem>
                  <SelectItem value="imperial">Imperial (lb)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Bodyweight"
              htmlFor="settings-bodyweight"
              hint="Used to approximate calories burned."
            >
              <div className="relative">
                <Input
                  id="settings-bodyweight"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={displayWeight}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  {isImperial ? "lb" : "kg"}
                </span>
              </div>
            </Field>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Sound */}
        {/* ----------------------------------------------------------------- */}
        <section className="space-y-4">
          <SectionTitle icon={Volume2}>Sound</SectionTitle>
          <div className="surface space-y-6 p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              Audio cues for transitions and countdowns.
            </p>
            <Field
              label="Sound effects"
              htmlFor="settings-sound"
              hint="Play beeps and cues during workouts."
            >
              <div className="flex sm:justify-end">
                <Switch
                  id="settings-sound"
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) =>
                    app.updateSettings({ soundEnabled: checked })
                  }
                />
              </div>
            </Field>

            <Field
              label="Volume"
              hint={`${Math.round(settings.volume * 100)}%`}
            >
              <Slider
                value={[settings.volume]}
                min={0}
                max={1}
                step={0.01}
                disabled={!settings.soundEnabled}
                onValueChange={(vals) =>
                  app.updateSettings({ volume: vals[0] ?? 0 })
                }
                className={cn(
                  !settings.soundEnabled && "opacity-50",
                )}
              />
            </Field>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Data */}
        {/* ----------------------------------------------------------------- */}
        <section className="space-y-4">
          <SectionTitle>Data</SectionTitle>
          <div className="surface space-y-6 p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              Back up, restore, or wipe everything on this device.
            </p>
            {dataMessage ? (
              <div
                role="status"
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm",
                  dataMessage.kind === "success"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-destructive/50 bg-destructive/10 text-destructive",
                )}
              >
                {dataMessage.text}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleExport}
                className="glow-cta flex h-12 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-6 font-display text-sm uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110"
              >
                <Download className="size-4" />
                Export all data
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest transition-colors hover:border-primary/40"
              >
                <Upload className="size-4" />
                Import data
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFilePicked}
            />

            <p className="text-xs text-muted-foreground">
              Export downloads a JSON backup of your settings, custom workouts,
              and history. Importing replaces all current data.
            </p>

            <div className="border-t border-border/60 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-display text-sm uppercase tracking-wide text-destructive">
                    Danger zone
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete all data on this device.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="gap-2 font-display uppercase tracking-wide"
                  onClick={() => setClearDialogOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Clear all data
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Import confirmation dialog */}
      {/* ------------------------------------------------------------------- */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open)
          if (!open) setPendingImport(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase tracking-wide">
              Import data?
            </DialogTitle>
            <DialogDescription>
              This replaces all current data — your settings, custom workouts,
              and history will be overwritten. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false)
                setPendingImport(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmImport}
              className="font-display uppercase tracking-wide"
            >
              Replace data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Clear confirmation dialog */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide">
              <AlertTriangle className="size-5 text-destructive" />
              Clear all data?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes all settings, custom workouts, and
              history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmClear}
              className="font-display uppercase tracking-wide"
            >
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
