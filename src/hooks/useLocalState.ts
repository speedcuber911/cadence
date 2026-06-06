import { useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// useLocalState — useState that mirrors to localStorage (best-effort).
// All storage access is wrapped in try/catch so SSR / private mode / quota
// errors never crash the app; on failure it simply behaves like useState.
// ---------------------------------------------------------------------------

export function useLocalState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      // ignore — fall back to initial
    }
    return initial
  })

  // Keep latest key in a ref so the persist effect doesn't need it as a dep
  // for the value write, while still re-running when the key itself changes.
  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(value))
    } catch {
      // ignore write failures (quota, private mode, etc.)
    }
  }, [key, value])

  return [value, setValue]
}
