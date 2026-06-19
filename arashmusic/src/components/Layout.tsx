import { useEffect } from "react"
import { ChevronLeft, ChevronRight, Lock, LogOut } from "lucide-react"
import { Outlet, useNavigate } from "react-router-dom"
import { AudioEngine } from "../audio/AudioEngine"
import { useAuthStore } from "../store/authStore"
import { useLockStore } from "../store/lockStore"
import { usePlayerStore } from "../store/playerStore"
import { useUiStore } from "../store/uiStore"
import { MobileNav } from "./MobileNav"
import { NowPlaying } from "./NowPlaying"
import { PlayerBar } from "./PlayerBar"
import { QueuePanel } from "./QueuePanel"
import { Sidebar } from "./Sidebar"

export function Layout() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const lock = useLockStore((s) => s.lock)
  const requestSetup = useLockStore((s) => s.requestSetup)
  const hasPin = useLockStore((s) => s.pinHash !== null)
  const nowPlayingOpen = useUiStore((s) => s.nowPlayingOpen)
  const queueOpen = useUiStore((s) => s.queueOpen)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      const store = usePlayerStore.getState()
      const audio = document.querySelector("audio")
      if (event.code === "Space") {
        event.preventDefault()
        store.toggle()
      } else if (event.code === "ArrowRight" && audio) {
        audio.currentTime = Math.min(audio.duration || audio.currentTime, audio.currentTime + 5)
      } else if (event.code === "ArrowLeft" && audio) {
        audio.currentTime = Math.max(0, audio.currentTime - 5)
      } else if (event.code === "ArrowUp") {
        event.preventDefault()
        store.setVolume(Math.min(1, store.volume + 0.05))
      } else if (event.code === "ArrowDown") {
        event.preventDefault()
        store.setVolume(Math.max(0, store.volume - 0.05))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="app">
      <div className="app-body">
        <Sidebar />
        <main className="main">
          <div className="topbar">
            <div className="topbar-nav">
              <button className="round-btn" onClick={() => navigate(-1)} aria-label="Back">
                <ChevronLeft size={20} />
              </button>
              <button className="round-btn" onClick={() => navigate(1)} aria-label="Forward">
                <ChevronRight size={20} />
              </button>
            </div>
            <div style={{ flex: 1 }} />
            <button
              className="round-btn"
              onClick={hasPin ? lock : requestSetup}
              aria-label={hasPin ? "Lock" : "Add passcode"}
            >
              <Lock size={17} />
            </button>
            <button className="round-btn" onClick={logout} aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
          <Outlet />
        </main>
        {queueOpen ? <QueuePanel /> : null}
      </div>
      <PlayerBar />
      <MobileNav />
      {nowPlayingOpen ? <NowPlaying /> : null}
      <AudioEngine />
    </div>
  )
}
