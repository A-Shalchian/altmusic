import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface OfflineItem {
  id: string
  title: string
  artist: string
  coverArt?: string
  size: number
}

interface OfflineState {
  items: OfflineItem[]
  has: (id: string) => boolean
  add: (item: OfflineItem) => void
  remove: (id: string) => void
  clear: () => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (id) => get().items.some((item) => item.id === id),
      add: (item) => set((s) => (s.items.some((i) => i.id === item.id) ? {} : { items: [...s.items, item] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] })
    }),
    { name: "arashmusic-offline" }
  )
)
