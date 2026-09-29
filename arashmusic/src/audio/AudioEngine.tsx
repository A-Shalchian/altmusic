import { useEffect, useRef } from "react"
import type { Song } from "../api/types"
import { coverArtUrl, getRandomSongs, getSimilarSongs, scrobble } from "../api/subsonic"
import { engine } from "./engine"
import { usePlayerStore } from "../store/playerStore"
import { useHistoryStore } from "../store/historyStore"
import { useSettingsStore } from "../store/settingsStore"

export function AudioEngine() {
  const queue = usePlayerStore((s) => s.queue)
  const index = usePlayerStore((s) => s.index)
  const playing = usePlayerStore((s) => s.playing)
  const volume = usePlayerStore((s) => s.volume)
  const setPlaying = usePlayerStore((s) => s.setPlaying)
  const setProgress = usePlayerStore((s) => s.setProgress)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const record = useHistoryStore((s) => s.record)

  const crossfade = useSettingsStore((s) => s.crossfade)
  const eqEnabled = useSettingsStore((s) => s.eqEnabled)
  const eqGains = useSettingsStore((s) => s.eqGains)
  const replayGain = useSettingsStore((s) => s.replayGain)
  const preamp = useSettingsStore((s) => s.preamp)

  const scrobbledRef = useRef<string | null>(null)
  const autoplayingRef = useRef(false)
  const current = queue[index]

  useEffect(() => {
    function autoplayMore() {
      if (autoplayingRef.current) return
      autoplayingRef.current = true
      const state = usePlayerStore.getState()
      const seed = state.queue[state.index]
      void (async () => {
        let more: Song[] = []
        if (seed) {
          try {
            more = await getSimilarSongs(seed.id, 25)
          } catch (e) {
            void e
          }
        }
        if (!more.length) {
          try {
            more = await getRandomSongs(25)
          } catch (e) {
            void e
          }
        }
        const existing = new Set(state.queue.map((s) => s.id))
        more = more.filter((s) => !existing.has(s.id))
        autoplayingRef.current = false
        if (more.length) {
          usePlayerStore.getState().enqueue(more)
          usePlayerStore.getState().next()
        } else {
          usePlayerStore.getState().setPlaying(false)
        }
      })()
    }

    engine.setup({
      onTime: (time, duration) => {
        setProgress(time)
        if (duration) setDuration(duration)
        if ("mediaSession" in navigator && duration && navigator.mediaSession.setPositionState) {
          try {
            navigator.mediaSession.setPositionState({ duration, position: time, playbackRate: 1 })
          } catch (e) {
            void e
          }
        }
        const state = usePlayerStore.getState()
        const cur = state.queue[state.index]
        if (cur && scrobbledRef.current !== cur.id && duration && time / duration > 0.5) {
          scrobbledRef.current = cur.id
          scrobble(cur.id).catch(() => undefined)
        }
      },
      onEnded: () => {
        const { queue: q, index: i, repeat } = usePlayerStore.getState()
        if (repeat === "off" && i >= q.length - 1) autoplayMore()
        else usePlayerStore.getState().next()
      },
      getNext: () => {
        const { queue: q, index: i, repeat } = usePlayerStore.getState()
        if (repeat === "one") return null
        if (i < q.length - 1) return q[i + 1]
        if (repeat === "all") return q[0]
        return null
      },
      onAdvance: () => usePlayerStore.getState().next()
    })

    // the desktop app forwards global media keys here
    ;(window as unknown as { amusicMedia: Record<string, () => void> }).amusicMedia = {
      toggle: () => usePlayerStore.getState().toggle(),
      next: () => usePlayerStore.getState().next(),
      prev: () => usePlayerStore.getState().prev()
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => setPlaying(true))
      navigator.mediaSession.setActionHandler("pause", () => setPlaying(false))
      navigator.mediaSession.setActionHandler("nexttrack", () => usePlayerStore.getState().next())
      navigator.mediaSession.setActionHandler("previoustrack", () => usePlayerStore.getState().prev())
      navigator.mediaSession.setActionHandler("seekforward", (d) =>
        engine.seek(engine.getCurrentTime() + (d.seekOffset || 10))
      )
      navigator.mediaSession.setActionHandler("seekbackward", (d) =>
        engine.seek(Math.max(0, engine.getCurrentTime() - (d.seekOffset || 10)))
      )
      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (d.seekTime != null) engine.seek(d.seekTime)
      })
    }
  }, [])

  useEffect(() => {
    if (!current) return
    if (engine.currentSongId() === current.id) return
    scrobbledRef.current = null
    record(current)
    engine.load(current, usePlayerStore.getState().playing)
  }, [current?.id])

  useEffect(() => {
    if (!current) return
    if (playing) engine.play()
    else engine.pause()
  }, [playing, current?.id])

  useEffect(() => {
    engine.setVolume(volume)
  }, [volume])

  useEffect(() => {
    engine.setSettings({ crossfade, eqEnabled, eqGains, replayGain, preamp })
  }, [crossfade, eqEnabled, eqGains, replayGain, preamp])

  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist || "Unknown artist",
      album: current.album || "",
      artwork: current.coverArt
        ? [{ src: coverArtUrl(current.coverArt, 512), sizes: "512x512", type: "image/jpeg" }]
        : []
    })
  }, [current?.id])

  return null
}
