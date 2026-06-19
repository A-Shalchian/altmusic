import { Home, ListMusic, Music2, Search } from "lucide-react"
import { NavLink } from "react-router-dom"

export function MobileNav() {
  return (
    <nav className="mobile-nav">
      <NavLink to="/" end>
        <Home size={21} />
        Home
      </NavLink>
      <NavLink to="/search">
        <Search size={21} />
        Search
      </NavLink>
      <NavLink to="/songs">
        <Music2 size={21} />
        Songs
      </NavLink>
      <NavLink to="/playlists">
        <ListMusic size={21} />
        Library
      </NavLink>
    </nav>
  )
}
