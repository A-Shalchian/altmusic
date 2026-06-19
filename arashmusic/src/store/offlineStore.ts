import { create } from "zustand"
import { persist } from "zustand/middleware"

interface OfflineState {
  ids: string[]
  has: (id: string) => boolean
  add: (id: string) => void
  remove: (id: string) => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      ids: [],
      has: (id) => get().ids.includes(id),
      add: (id) => set((s) => (s.ids.includes(id) ? {} : { ids: [...s.ids, id] })),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) }))
    }),
    { name: "arashmusic-offline" }
  )
)
