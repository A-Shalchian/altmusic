import { Heart, Play } from "lucide-react"
import { TrackList } from "../components/TrackList"
import { useStarred } from "../queries/music"
import { usePlayerStore } from "../store/playerStore"
import { formatCount } from "../lib/format"

export function Favorites() {
  const { data, isLoading } = useStarred()
  const playQueue = usePlayerStore((s) => s.playQueue)
  const songs = data ?? []

  return (
    <div className="content fade-up">
      <div className="hero">
        <div
          className="hero-art"
          style={{ display: "grid", placeItems: "center", background: "linear-gradient(150deg, var(--accent-deep), #7a3d12)" }}
        >
          <Heart size={84} fill="#1a1205" color="#1a1205" />
        </div>
        <div className="hero-meta">
          <span className="hero-kicker">Collection</span>
          <h1 className="hero-title">Favorites</h1>
          <p className="hero-sub">{formatCount(songs.length, "track")}</p>
        </div>
      </div>

      {songs.length > 0 ? (
        <button
          className="btn-primary"
          style={{ width: 150, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={() => playQueue(songs, 0)}
        >
          <Play size={18} fill="currentColor" />
          Play all
        </button>
      ) : null}

      {isLoading ? <div className="spinner" /> : null}

      {!isLoading && songs.length === 0 ? (
        <div className="empty">
          <Heart size={40} />
          <h3>No favorites yet</h3>
          <p>Tap the heart on any track to save it here.</p>
        </div>
      ) : (
        <TrackList songs={songs} />
      )}
    </div>
  )
}
