import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Song } from "../api/types"

const MAX_HISTORY = 40

interface HistoryState {
  recent: Song[]
  record: (song: Song) => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      recent: [],
      record: (song) =>
        set((s) => {
          if (s.recent[0]?.id === song.id) return {}
          const recent = [song, ...s.recent.filter((item) => item.id !== song.id)].slice(0, MAX_HISTORY)
          return { recent }
        })
    }),
    { name: "arashmusic-history" }
  )
)
