import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Layout } from "./components/Layout"
import { ArtistView } from "./screens/ArtistView"
import { Favorites } from "./screens/Favorites"
import { Home } from "./screens/Home"
import { LockScreen } from "./screens/LockScreen"
import { LoginScreen } from "./screens/LoginScreen"
import { Playlists } from "./screens/Playlists"
import { PlaylistView } from "./screens/PlaylistView"
import { Search } from "./screens/Search"
import { Settings } from "./screens/Settings"
import { SmartList } from "./screens/SmartList"
import { Songs } from "./screens/Songs"
import { Stats } from "./screens/Stats"
import { useAuthStore } from "./store/authStore"
import { useLockStore } from "./store/lockStore"

export function App() {
  const loggedIn = useAuthStore((s) => s.loggedIn)
  const unlocked = useLockStore((s) => s.unlocked)
  const setupMode = useLockStore((s) => s.setupMode)
  const hasPin = useLockStore((s) => s.pinHash !== null)

  if (!loggedIn) return <LoginScreen />
  if (hasPin && !unlocked) return <LockScreen />
  if (!hasPin && setupMode) return <LockScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/songs" element={<Songs />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/playlist/:id" element={<PlaylistView />} />
          <Route path="/artist/:id" element={<ArtistView />} />
          <Route path="/smart/:rule" element={<SmartList />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
