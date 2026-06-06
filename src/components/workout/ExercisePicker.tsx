import { useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EXERCISES } from "@/data/exercises"
import { poseSvg } from "@/data/poses"
import type { Exercise, ExerciseCategory } from "@/types"

const POSE_COLOR = "#68f2c2"

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: "Strength",
  cardio: "Cardio",
  mobility: "Mobility",
  core: "Core",
}

const CATEGORY_OPTIONS: ExerciseCategory[] = [
  "strength",
  "cardio",
  "mobility",
  "core",
]

function defaultWork(ex: Exercise): string {
  return ex.defaultMode === "time"
    ? `${ex.defaultDurationSec}s`
    : `${ex.defaultSets}×${ex.defaultReps}`
}

export function ExercisePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onPick: (exercise: Exercise) => void
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<ExerciseCategory | "all">("all")

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return EXERCISES.filter((ex) => {
      if (category !== "all" && ex.category !== category) return false
      if (q && !ex.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [query, category])

  function handlePick(ex: Exercise) {
    onPick(ex)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl uppercase leading-none tracking-wide">
            Add an exercise
          </DialogTitle>
          <DialogDescription>
            Search the library and tap an exercise to add it to your workout.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises…"
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as ExerciseCategory | "all")}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="eyebrow">
          {results.length} {results.length === 1 ? "exercise" : "exercises"}
        </div>

        <div className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
          {results.map((ex) => {
            const svg = poseSvg(ex.illustration, POSE_COLOR)
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => handlePick(ex)}
                className="surface flex w-full items-center gap-3 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] bg-secondary/40">
                  <div
                    className="size-10"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base uppercase leading-tight">
                    {ex.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="capitalize">
                      {CATEGORY_LABEL[ex.category]}
                    </Badge>
                    <span className="capitalize">{ex.defaultMode}</span>
                    <span>·</span>
                    <span className="font-medium text-recovery">
                      {defaultWork(ex)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}

          {results.length === 0 && (
            <div className="surface border-dashed p-8 text-center text-sm text-muted-foreground">
              No exercises match your search.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
