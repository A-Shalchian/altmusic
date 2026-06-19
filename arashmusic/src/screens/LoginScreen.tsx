import type * as React from "react"
import { useState } from "react"
import { ping } from "../api/subsonic"
import { useAuthStore } from "../store/authStore"
import { useLockStore } from "../store/lockStore"

export function LoginScreen() {
  const setCredentials = useAuthStore((s) => s.setCredentials)
  const requestSetup = useLockStore((s) => s.requestSetup)
  const hasPin = useLockStore((s) => s.pinHash !== null)
  const [serverUrl, setServerUrl] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      const target = serverUrl.trim() || window.location.origin
      const ok = await ping({ serverUrl: target, username: username.trim(), password })
      if (!ok) {
        setError("Could not sign in. Check the details and try again.")
        setBusy(false)
        return
      }
      setCredentials(target, username.trim(), password)
      if (!hasPin) requestSetup()
    } catch {
      setError("Could not reach the server. Check the address.")
      setBusy(false)
    }
  }

  return (
    <div className="screen-center">
      <form className="auth-card fade-up" onSubmit={submit}>
        <div className="auth-brand">
          <img src="/icon.svg" alt="arashmusic" />
          <h1>
            arash<b>music</b>
          </h1>
        </div>
        <p className="auth-lead">Connect to your music server to start listening.</p>

        <div className="field">
          <label>Server address</label>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://laptop.your-tailnet.ts.net"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="your password"
          />
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <button className="btn-primary" type="submit" disabled={busy || !username || !password}>
          {busy ? "Connecting" : "Sign in"}
        </button>
      </form>
    </div>
  )
}
