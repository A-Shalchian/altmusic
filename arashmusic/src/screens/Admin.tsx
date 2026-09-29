import type * as React from "react"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Sparkles, Trash2, UserPlus } from "lucide-react"
import { createUser, deleteUser, listUsers, runDiscoverNow, setUserPassword } from "../api/manage"
import { useMe } from "../queries/music"

function lastSeen(value: string | null): string {
  if (!value) return "Never signed in"
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "Never signed in"
  return "Last active " + date.toLocaleDateString()
}

export function Admin() {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: listUsers,
    enabled: me?.admin === true
  })
  const [userName, setUserName] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  if (me && !me.admin) {
    return (
      <div className="content fade-up">
        <h1 className="greeting">Users</h1>
        <p className="settings-desc">Only the admin can manage users.</p>
      </div>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      await createUser(userName.trim(), name.trim(), password, isAdmin)
      setMessage("Created " + userName.trim() + ". Send them the app address, username and password.")
      setUserName("")
      setName("")
      setPassword("")
      setIsAdmin(false)
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] })
    } catch (err) {
      setMessage("Could not create user: " + (err as Error).message)
    }
    setBusy(false)
  }

  async function resetPassword(id: string, who: string) {
    const next = window.prompt("New password for " + who)
    if (!next) return
    try {
      await setUserPassword(id, next)
      setMessage("Password changed for " + who + ".")
    } catch (err) {
      setMessage("Could not change password: " + (err as Error).message)
    }
  }

  async function remove(id: string, who: string) {
    if (!window.confirm("Delete " + who + "? Their playlists, likes and play history are removed. Songs stay in the library.")) {
      return
    }
    try {
      await deleteUser(id)
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] })
    } catch (err) {
      setMessage("Could not delete user: " + (err as Error).message)
    }
  }

  async function discoverNow() {
    try {
      const started = await runDiscoverNow()
      setMessage(started ? "Discover Mix is building for everyone. It takes a few minutes." : "Discover Mix is already running.")
    } catch (err) {
      setMessage("Could not start Discover Mix: " + (err as Error).message)
    }
  }

  return (
    <div className="content fade-up">
      <h1 className="greeting">Users</h1>
      {message ? <p className="admin-message">{message}</p> : null}

      <section className="settings-section">
        <h2 className="settings-title">People</h2>
        <p className="settings-desc">Everyone shares one library. Likes, playlists, stats and recommendations are separate.</p>
        {isLoading ? <p className="settings-desc">Loading</p> : null}
        {error ? <p className="auth-error">{(error as Error).message}</p> : null}
        <div className="admin-users">
          {(users ?? []).map((user) => (
            <div key={user.id} className="admin-user">
              <div className="admin-user-info">
                <span className="admin-user-name">
                  {user.name || user.userName}
                  {user.isAdmin ? <span className="admin-badge">admin</span> : null}
                </span>
                <span className="admin-user-meta">
                  {user.userName} · {lastSeen(user.lastAccessAt)}
                </span>
              </div>
              <button className="icon-btn" onClick={() => resetPassword(user.id, user.userName)} aria-label="Change password">
                <KeyRound size={17} />
              </button>
              {user.userName !== me?.username ? (
                <button className="icon-btn danger" onClick={() => remove(user.id, user.userName)} aria-label="Delete user">
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-title">Add someone</h2>
        <p className="settings-desc">You pick their password and send it to them.</p>
        <form className="admin-form" onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. sara"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label>Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" />
          </div>
          <div className="field">
            <label>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="at least 4 characters" />
          </div>
          <label className="admin-check">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            Admin (can delete songs and manage users)
          </label>
          <button className="btn-primary" type="submit" disabled={busy || !userName.trim() || password.length < 4}>
            <UserPlus size={16} style={{ verticalAlign: "-3px", marginRight: 8 }} />
            {busy ? "Creating" : "Create user"}
          </button>
        </form>
      </section>

      <section className="settings-section">
        <h2 className="settings-title">Discover Mix</h2>
        <p className="settings-desc">Runs every night at 4am. Build everyone's mix now instead.</p>
        <button className="chip-btn" onClick={discoverNow}>
          <Sparkles size={16} />
          Build now
        </button>
      </section>
    </div>
  )
}
