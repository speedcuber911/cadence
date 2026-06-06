import { useCallback, useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// useAudio — pure Web Audio API cue engine (no external files, no deps).
//
// AudioContext is created lazily on the first unlock() call, which MUST happen
// inside a user gesture (browsers block audio otherwise). A single masterGain
// node controls volume; muting sets its gain to 0. All cues are synthesised
// from oscillators with short exponential fade in/out to avoid clicks.
// ---------------------------------------------------------------------------

export interface UseAudioOptions {
  enabled?: boolean
  volume?: number
}

export interface UseAudio {
  unlock(): void
  setEnabled(b: boolean): void
  setVolume(v: number): void
  enabled: boolean
  volume: number
  playStartBeep(): void
  playRestBeep(): void
  playCountdownBeep(): void
  playCompleteChime(): void
  playPhaseChime(): void
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

export function useAudio(opts: UseAudioOptions = {}): UseAudio {
  const initialEnabled = opts.enabled ?? true
  const initialVolume = clamp01(opts.volume ?? 0.8)

  // State drives re-renders so consumers see current values.
  const [enabled, setEnabledState] = useState(initialEnabled)
  const [volume, setVolumeState] = useState(initialVolume)

  // Refs mirror state so the (stable) callbacks always read current values
  // without being re-created on every change.
  const enabledRef = useRef(initialEnabled)
  const volumeRef = useRef(initialVolume)

  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const readyRef = useRef(false)

  // Push the current effective volume (0 when disabled) onto the master gain.
  const applyMasterVolume = useCallback(() => {
    const ctx = ctxRef.current
    const master = masterRef.current
    if (!ctx || !master) return
    const target = enabledRef.current ? volumeRef.current : 0
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.015)
  }, [])

  const unlock = useCallback(() => {
    let ctx = ctxRef.current
    if (!ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return
      ctx = new Ctor()
      ctxRef.current = ctx
      const master = ctx.createGain()
      master.gain.setValueAtTime(enabledRef.current ? volumeRef.current : 0, ctx.currentTime)
      master.connect(ctx.destination)
      masterRef.current = master
      readyRef.current = true
    }
    if (ctx.state === "suspended") {
      void ctx.resume()
    }
    applyMasterVolume()
  }, [applyMasterVolume])

  // Core tone helper — ported from the proven legacy implementation.
  const tone = useCallback(
    (
      freq: number,
      duration: number,
      delay = 0,
      type: OscillatorType = "sine",
      peak = 0.18,
    ) => {
      const ctx = ctxRef.current
      const master = masterRef.current
      const muted = !enabledRef.current
      if (!readyRef.current || !ctx || !master || muted) return

      const startAt = ctx.currentTime + delay
      const endAt = startAt + duration
      const fade = Math.min(0.025, duration / 3)

      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, startAt)
      g.gain.setValueAtTime(0.0001, startAt)
      g.gain.exponentialRampToValueAtTime(peak, startAt + fade)
      g.gain.setValueAtTime(peak, Math.max(startAt + fade, endAt - fade))
      g.gain.exponentialRampToValueAtTime(0.0001, endAt)
      osc.connect(g)
      g.connect(master)
      osc.start(startAt)
      osc.stop(endAt + 0.03)
    },
    [],
  )

  const setEnabled = useCallback(
    (b: boolean) => {
      enabledRef.current = b
      setEnabledState(b)
      applyMasterVolume()
    },
    [applyMasterVolume],
  )

  const setVolume = useCallback(
    (v: number) => {
      const next = clamp01(v)
      volumeRef.current = next
      setVolumeState(next)
      applyMasterVolume()
    },
    [applyMasterVolume],
  )

  const playStartBeep = useCallback(() => {
    tone(740, 0.12, 0, "triangle", 0.17)
  }, [tone])

  const playRestBeep = useCallback(() => {
    tone(430, 0.14, 0, "sine", 0.105)
  }, [tone])

  const playCountdownBeep = useCallback(() => {
    tone(900, 0.085, 0, "triangle", 0.13)
    tone(900, 0.085, 0.16, "triangle", 0.13)
  }, [tone])

  const playCompleteChime = useCallback(() => {
    const notes = [590, 740, 880, 1174]
    notes.forEach((f, i) => {
      tone(f, 0.16, i * 0.13, "sine", 0.16)
    })
  }, [tone])

  const playPhaseChime = useCallback(() => {
    const notes = [620, 780, 980]
    notes.forEach((f, i) => {
      tone(f, 0.14, i * 0.12, "sine", 0.15)
    })
  }, [tone])

  // Clean up the AudioContext on unmount.
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current
      readyRef.current = false
      masterRef.current = null
      ctxRef.current = null
      if (ctx && ctx.state !== "closed") {
        void ctx.close()
      }
    }
  }, [])

  return {
    unlock,
    setEnabled,
    setVolume,
    enabled,
    volume,
    playStartBeep,
    playRestBeep,
    playCountdownBeep,
    playCompleteChime,
    playPhaseChime,
  }
}
