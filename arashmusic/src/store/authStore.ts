import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AuthState {
  serverUrl: string
  username: string
  password: string
  loggedIn: boolean
  setCredentials: (serverUrl: string, username: string, password: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      serverUrl: "",
      username: "",
      password: "",
      loggedIn: false,
      setCredentials: (serverUrl, username, password) =>
        set({ serverUrl: serverUrl.replace(/\/+$/, ""), username, password, loggedIn: true }),
      logout: () => set({ password: "", loggedIn: false })
    }),
    { name: "arashmusic-auth" }
  )
)
