import { useEffect, useRef } from "react"
import type { Song } from "../api/types"
import { coverArtUrl, getRandomSongs, getSimilarSongs, scrobble, streamUrl } from "../api/subsonic"
import { usePlayerStore } from "../store/playerStore"
import { useHistoryStore } from "../store/historyStore"

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrobbledRef = useRef<string | null>(null)
  const autoplayingRef = useRef(false)

  const queue = usePlayerStore((s) => s.queue)
  const index = usePlayerStore((s) => s.index)
  const playing = usePlayerStore((s) => s.playing)
  const volume = usePlayerStore((s) => s.volume)
  const setPlaying = usePlayerStore((s) => s.setPlaying)
  const setProgress = usePlayerStore((s) => s.setProgress)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const record = useHistoryStore((s) => s.record)

  const current = queue[index]

  useEffect(() => {
    if (!audioRef.current) return
    if (!current) {
      audioRef.current.removeAttribute("src")
      return
    }
    audioRef.current.src = streamUrl(current.id)
    audioRef.current.load()
    scrobbledRef.current = null
    record(current)
    if (playing) {
      audioRef.current.play().catch(() => setPlaying(false))
    }
  }, [current?.id])

  useEffect(() => {
    if (!audioRef.current) return
    if (playing) audioRef.current.play().catch(() => setPlaying(false))
    else audioRef.current.pause()
  }, [playing])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

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
    navigator.mediaSession.setActionHandler("play", () => setPlaying(true))
    navigator.mediaSession.setActionHandler("pause", () => setPlaying(false))
    navigator.mediaSession.setActionHandler("nexttrack", () => next())
    navigator.mediaSession.setActionHandler("previoustrack", () => prev())
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset || 10))
    })
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      if (audioRef.current) audioRef.current.currentTime = audioRef.current.currentTime + (details.seekOffset || 10)
    })
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (audioRef.current && details.seekTime != null) audioRef.current.currentTime = details.seekTime
    })
  }, [current?.id])

  async function autoplayMore() {
    if (autoplayingRef.current) return
    autoplayingRef.current = true
    const state = usePlayerStore.getState()
    const seed = state.queue[state.index]
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
  }

  function onEnded() {
    const { queue: q, index: i, repeat } = usePlayerStore.getState()
    if (repeat === "off" && i >= q.length - 1) {
      autoplayMore()
    } else {
      next()
    }
  }

  function onTimeUpdate() {
    const el = audioRef.current
    if (!el) return
    setProgress(el.currentTime)
    if ("mediaSession" in navigator && el.duration && navigator.mediaSession.setPositionState) {
      try {
        navigator.mediaSession.setPositionState({
          duration: el.duration,
          position: el.currentTime,
          playbackRate: el.playbackRate
        })
      } catch (e) {
        void e
      }
    }
    if (current && !scrobbledRef.current && el.duration && el.currentTime / el.duration > 0.5) {
      scrobbledRef.current = current.id
      scrobble(current.id).catch(() => undefined)
    }
  }

  function onLoadedMetadata() {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={onLoadedMetadata}
      onEnded={onEnded}
      onPlay={() => setPlaying(true)}
      onPause={() => {
        if (audioRef.current && !audioRef.current.ended) setPlaying(false)
      }}
    />
  )
}
