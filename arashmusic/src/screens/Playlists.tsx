import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Clock3, Heart, ListMusic, Plus, Sparkles, TrendingUp } from "lucide-react"
import { createPlaylist } from "../api/subsonic"
import { Cover } from "../components/Cover"
import { usePlaylists } from "../queries/music"
import { formatCount } from "../lib/format"

export function Playlists() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: playlists, isLoading } = usePlaylists()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  async function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      const id = await createPlaylist(trimmed)
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
      setCreating(false)
      setName("")
      if (id) navigate("/playlist/" + id)
    } catch (error) {
      window.alert("Could not create: " + (error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content fade-up">
      <div className="list-header">
        <h1 className="greeting" style={{ padding: 0 }}>
          Your Library
        </h1>
        <button className="chip-btn" onClick={() => setCreating(true)}>
          <Plus size={17} />
          New playlist
        </button>
      </div>

      {creating ? (
        <div className="inline-create">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            onKeyDown={(e) => {
              if (e.key === "Enter") create()
              if (e.key === "Escape") setCreating(false)
            }}
          />
          <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}>
            Create
          </button>
          <button className="btn-ghost" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      <div className="card-grid" style={{ marginTop: 18 }}>
        <div className="card liked-card" onClick={() => navigate("/favorites")}>
          <div className="card-art-wrap">
            <div className="card-art liked-art">
              <Heart size={54} fill="#1a1205" color="#1a1205" />
            </div>
          </div>
          <div className="card-title">Liked Songs</div>
          <div className="card-sub">Your favorites</div>
        </div>

        <div className="card" onClick={() => navigate("/smart/recent")}>
          <div className="card-art-wrap">
            <div className="card-art" style={{ display: "grid", placeItems: "center", background: "linear-gradient(150deg, var(--accent), var(--accent-deep))" }}>
              <Sparkles size={48} color="#1a1205" />
            </div>
          </div>
          <div className="card-title">Recently Added</div>
          <div className="card-sub">Smart mix</div>
        </div>

        <div className="card" onClick={() => navigate("/smart/most-played")}>
          <div className="card-art-wrap">
            <div className="card-art" style={{ display: "grid", placeItems: "center", background: "linear-gradient(150deg, #6f53c4, #3a2d6b)" }}>
              <TrendingUp size={48} color="#fff" />
            </div>
          </div>
          <div className="card-title">Most Played</div>
          <div className="card-sub">Smart mix</div>
        </div>

        <div className="card" onClick={() => navigate("/smart/never-played")}>
          <div className="card-art-wrap">
            <div className="card-art" style={{ display: "grid", placeItems: "center", background: "linear-gradient(150deg, #2f8f7a, #16413a)" }}>
              <Clock3 size={48} color="#fff" />
            </div>
          </div>
          <div className="card-title">Never Played</div>
          <div className="card-sub">Smart mix</div>
        </div>

        {isLoading ? null : (playlists ?? []).map((playlist) => (
          <div key={playlist.id} className="card" onClick={() => navigate("/playlist/" + playlist.id)}>
            <div className="card-art-wrap">
              {playlist.coverArt ? (
                <Cover coverArt={playlist.coverArt} size={320} className="card-art" alt={playlist.name} />
              ) : (
                <div className="card-art" style={{ display: "grid", placeItems: "center" }}>
                  <ListMusic size={46} color="var(--accent)" />
                </div>
              )}
            </div>
            <div className="card-title">{playlist.name}</div>
            <div className="card-sub">{formatCount(playlist.songCount, "track")}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
