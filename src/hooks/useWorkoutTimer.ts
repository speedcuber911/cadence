import { useCallback, useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// useWorkoutTimer — timestamp-based countdown driven by requestAnimationFrame.
//
// Why timestamps instead of setInterval: setInterval drifts (the browser is not
// obligated to fire it precisely, and missed/late ticks accumulate error). By
// anchoring to performance.now() and recomputing elapsed every frame, the
// remaining time stays accurate even across pauses, tab throttling, etc.
//
// The hook is agnostic to rep-vs-time: the caller decides whether to actually
// drive a countdown with `running`/`durationSec`. For a pure rep set you can
// leave it idle or ignore the countdown entirely.
// ---------------------------------------------------------------------------

export interface UseWorkoutTimerOptions {
  durationSec: number
  running: boolean
  onComplete(): void
  onSecondTick?(secondsRemaining: number): void
}

export interface UseWorkoutTimer {
  remainingSec: number
  elapsedSec: number
  reset(): void
}

export function useWorkoutTimer(opts: UseWorkoutTimerOptions): UseWorkoutTimer {
  const { durationSec, running, onComplete, onSecondTick } = opts

  const [remainingSec, setRemainingSec] = useState(() => Math.ceil(durationSec))
  const [elapsedSec, setElapsedSec] = useState(0)

  // Anchor timestamp: performance.now() at which "elapsed === 0" would have been.
  const intervalStartedAtRef = useRef(0)
  // Accumulated elapsed seconds captured when paused, so resume continues exactly.
  const elapsedWhenPausedRef = useRef(0)

  // Guards.
  const completedRef = useRef(false)
  const lastWholeRef = useRef(-1)
  const rafRef = useRef<number | null>(null)

  // Keep latest callbacks/duration in refs so the rAF loop closure stays current
  // without resubscribing the loop.
  const durationRef = useRef(durationSec)
  const onCompleteRef = useRef(onComplete)
  const onSecondTickRef = useRef(onSecondTick)
  durationRef.current = durationSec
  onCompleteRef.current = onComplete
  onSecondTickRef.current = onSecondTick

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    elapsedWhenPausedRef.current = 0
    completedRef.current = false
    lastWholeRef.current = -1
    setElapsedSec(0)
    setRemainingSec(Math.ceil(durationRef.current))
  }, [])

  // When the segment duration changes, treat it as a fresh segment.
  useEffect(() => {
    elapsedWhenPausedRef.current = 0
    completedRef.current = false
    lastWholeRef.current = -1
    setElapsedSec(0)
    setRemainingSec(Math.ceil(durationSec))
  }, [durationSec])

  // Drive / stop the rAF loop based on `running`.
  useEffect(() => {
    if (!running) {
      // Capture how far we got, then halt.
      if (rafRef.current !== null) {
        const now = performance.now()
        elapsedWhenPausedRef.current = Math.max(
          0,
          (now - intervalStartedAtRef.current) / 1000,
        )
      }
      stopLoop()
      return
    }

    // (Re)start: re-anchor so elapsed resumes from where we paused.
    intervalStartedAtRef.current =
      performance.now() - elapsedWhenPausedRef.current * 1000

    const frame = () => {
      const now = performance.now()
      const duration = durationRef.current
      const elapsed = (now - intervalStartedAtRef.current) / 1000
      const remaining = Math.max(0, duration - elapsed)

      setElapsedSec(elapsed)
      setRemainingSec(Math.ceil(remaining))

      // Fire onSecondTick exactly once per whole-second boundary crossed.
      const whole = Math.ceil(remaining)
      if (whole !== lastWholeRef.current) {
        lastWholeRef.current = whole
        onSecondTickRef.current?.(whole)
      }

      if (remaining <= 0) {
        if (!completedRef.current) {
          completedRef.current = true
          elapsedWhenPausedRef.current = duration
          onCompleteRef.current()
        }
        stopLoop()
        return
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      stopLoop()
    }
  }, [running, stopLoop])

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      stopLoop()
    }
  }, [stopLoop])

  return { remainingSec, elapsedSec, reset }
}
