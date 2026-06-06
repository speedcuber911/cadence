// ===========================================================================
// Small formatting helpers (pure).
// ===========================================================================

/** "M:SS" — e.g. 95 -> "1:35". */
export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** "32 min" — rounds seconds to whole minutes. */
export function formatMinutes(sec: number): string {
  const mins = Math.max(0, Math.round(sec / 60))
  return `${mins} min`
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** e.g. "Jun 6". */
export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** YYYY-MM-DD for the given date (defaults to now), in local time. */
export function isoDate(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, "0")
  const day = d.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Whole days between two ISO dates/timestamps (absolute value). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.floor(Math.abs(b - a) / MS_PER_DAY)
}
