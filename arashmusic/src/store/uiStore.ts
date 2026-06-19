import { create } from "zustand"

interface UiState {
  nowPlayingOpen: boolean
  queueOpen: boolean
  openNowPlaying: () => void
  closeNowPlaying: () => void
  toggleQueue: () => void
  closeQueue: () => void
}

export const useUiStore = create<UiState>((set) => ({
  nowPlayingOpen: false,
  queueOpen: false,
  openNowPlaying: () => set({ nowPlayingOpen: true }),
  closeNowPlaying: () => set({ nowPlayingOpen: false }),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  closeQueue: () => set({ queueOpen: false })
}))
