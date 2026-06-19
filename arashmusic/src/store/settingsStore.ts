import { create } from "zustand"
import { persist } from "zustand/middleware"

export const EQ_BANDS = [60, 150, 400, 1000, 2400, 6000, 12000]

interface SettingsState {
  crossfade: number
  eqEnabled: boolean
  eqGains: number[]
  replayGain: boolean
  preamp: number
  setCrossfade: (seconds: number) => void
  setEqEnabled: (on: boolean) => void
  setEqGain: (index: number, value: number) => void
  resetEq: () => void
  setReplayGain: (on: boolean) => void
  setPreamp: (db: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      crossfade: 0,
      eqEnabled: false,
      eqGains: EQ_BANDS.map(() => 0),
      replayGain: false,
      preamp: 0,
      setCrossfade: (seconds) => set({ crossfade: seconds }),
      setEqEnabled: (on) => set({ eqEnabled: on }),
      setEqGain: (index, value) =>
        set((s) => {
          const eqGains = s.eqGains.slice()
          eqGains[index] = value
          return { eqGains }
        }),
      resetEq: () => set({ eqGains: EQ_BANDS.map(() => 0) }),
      setReplayGain: (on) => set({ replayGain: on }),
      setPreamp: (db) => set({ preamp: db })
    }),
    { name: "arashmusic-settings" }
  )
)
