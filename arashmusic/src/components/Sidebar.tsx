import { useState } from "react"
import { Heart, Home, ListMusic, Music2, Plus, Search } from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { addToPlaylist } from "../api/subsonic"
import { usePlaylists } from "../queries/music"

export function Sidebar() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: playlists } = usePlaylists()
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  async function onDrop(event: React.DragEvent, playlistId: string) {
    event.preventDefault()
    setDropTarget(null)
    const songId = event.dataTransfer.getData("application/x-song-id")
    if (!songId) return
    try {
      await addToPlaylist(playlistId, songId)
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
      queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] })
    } catch (error) {
      window.alert("Could not add: " + (error as Error).message)
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/icon.svg" alt="arashmusic" />
        <span>
          arash<b>music</b>
        </span>
      </div>

      <nav className="nav">
        <NavLink to="/" className="nav-link" end>
          <Home size={20} />
          Home
        </NavLink>
        <NavLink to="/search" className="nav-link">
          <Search size={20} />
          Search
        </NavLink>
        <NavLink to="/songs" className="nav-link">
          <Music2 size={20} />
          Songs
        </NavLink>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-heading-row">
          <span className="sidebar-heading">Library</span>
          <button className="icon-btn" onClick={() => navigate("/playlists")} aria-label="New playlist">
            <Plus size={18} />
          </button>
        </div>
        <NavLink to="/favorites" className="sidebar-item liked-item">
          <Heart size={16} fill="currentColor" />
          Liked Songs
        </NavLink>
        <div className="sidebar-list">
          {(playlists ?? []).map((playlist) => (
            <div
              key={playlist.id}
              className={"sidebar-item with-icon" + (dropTarget === playlist.id ? " drop-target" : "")}
              onClick={() => navigate("/playlist/" + playlist.id)}
              onDragOver={(e) => {
                e.preventDefault()
                setDropTarget(playlist.id)
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => onDrop(e, playlist.id)}
            >
              <ListMusic size={16} />
              {playlist.name}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
