import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Song } from "../api/types"

type RepeatMode = "off" | "all" | "one"

interface PlayerState {
  queue: Song[]
  index: number
  playing: boolean
  shuffle: boolean
  repeat: RepeatMode
  volume: number
  progress: number
  duration: number
  current: () => Song | undefined
  playQueue: (songs: Song[], startIndex: number) => void
  toggle: () => void
  setPlaying: (playing: boolean) => void
  next: () => void
  prev: () => void
  enqueue: (songs: Song[]) => void
  playNext: (song: Song) => void
  removeAt: (index: number) => void
  move: (from: number, to: number) => void
  jumpTo: (index: number) => void
  setVolume: (volume: number) => void
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

function shuffled(songs: Song[], keepFirst: number): Song[] {
  const first = songs[keepFirst]
  const rest = songs.filter((_, i) => i !== keepFirst)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [first, ...rest]
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: 0,
      playing: false,
      shuffle: false,
      repeat: "off",
      volume: 0.8,
      progress: 0,
      duration: 0,
      current: () => get().queue[get().index],
      playQueue: (songs, startIndex) => {
        if (songs.length === 0) return
        const list = get().shuffle ? shuffled(songs, startIndex) : songs
        const index = get().shuffle ? 0 : startIndex
        set({ queue: list, index, playing: true, progress: 0 })
      },
      toggle: () => set((s) => ({ playing: !s.playing })),
      setPlaying: (playing) => set({ playing }),
      next: () => {
        const { queue, index, repeat } = get()
        if (queue.length === 0) return
        if (repeat === "one") {
          set({ progress: 0, playing: true })
          return
        }
        if (index < queue.length - 1) {
          set({ index: index + 1, progress: 0, playing: true })
        } else if (repeat === "all") {
          set({ index: 0, progress: 0, playing: true })
        } else {
          set({ playing: false, progress: 0 })
        }
      },
      prev: () => {
        const { index, progress } = get()
        if (progress > 3) {
          set({ progress: 0 })
          return
        }
        if (index > 0) set({ index: index - 1, progress: 0, playing: true })
        else set({ progress: 0 })
      },
      enqueue: (songs) => set((s) => ({ queue: [...s.queue, ...songs] })),
      playNext: (song) =>
        set((s) => {
          const queue = s.queue.slice()
          queue.splice(s.index + 1, 0, song)
          return { queue }
        }),
      removeAt: (i) =>
        set((s) => {
          const queue = s.queue.filter((_, idx) => idx !== i)
          let index = s.index
          if (i < s.index) index = s.index - 1
          else if (i === s.index) index = Math.min(s.index, queue.length - 1)
          return { queue, index: Math.max(0, index) }
        }),
      move: (from, to) =>
        set((s) => {
          if (from === to) return {}
          const queue = s.queue.slice()
          const [item] = queue.splice(from, 1)
          queue.splice(to, 0, item)
          let index = s.index
          if (from === s.index) index = to
          else {
            if (from < s.index) index -= 1
            if (to <= s.index) index += 1
          }
          return { queue, index }
        }),
      jumpTo: (index) => set({ index, progress: 0, playing: true }),
      setVolume: (volume) => set({ volume }),
      setProgress: (progress) => set({ progress }),
      setDuration: (duration) => set({ duration }),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      cycleRepeat: () =>
        set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" }))
    }),
    {
      name: "arashmusic-player",
      partialize: (state) => ({
        queue: state.queue,
        index: state.index,
        shuffle: state.shuffle,
        repeat: state.repeat,
        volume: state.volume
      })
    }
  )
)
