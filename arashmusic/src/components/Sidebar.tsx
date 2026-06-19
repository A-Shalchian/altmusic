import { Heart, Home, ListMusic, Music2, Plus, Search } from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"
import { usePlaylists } from "../queries/music"

export function Sidebar() {
  const navigate = useNavigate()
  const { data: playlists } = usePlaylists()

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
              className="sidebar-item with-icon"
              onClick={() => navigate("/playlist/" + playlist.id)}
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
