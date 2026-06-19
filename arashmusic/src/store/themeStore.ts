import { create } from "zustand"
import { persist } from "zustand/middleware"
import { applyAccent } from "../lib/theme"

export const ACCENT_PRESETS = ["#f4b740", "#ff6b5b", "#8b7bd8", "#4fc99a", "#5aa9f0", "#f06a9a", "#b6d94c"]

interface ThemeState {
  accent: string
  setAccent: (hex: string) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accent: "#f4b740",
      setAccent: (hex) => {
        applyAccent(hex)
        set({ accent: hex })
      }
    }),
    { name: "arashmusic-theme" }
  )
)
