import { Play, Shuffle, User } from "lucide-react"
import { useParams } from "react-router-dom"
import { Cover } from "../components/Cover"
import { TrackList } from "../components/TrackList"
import { useArtistSongs } from "../queries/music"
import { usePlayerStore } from "../store/playerStore"
import { formatCount } from "../lib/format"

export function ArtistView() {
  const { id } = useParams()
  const { data, isLoading } = useArtistSongs(id)
  const playQueue = usePlayerStore((s) => s.playQueue)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)

  if (isLoading) return <div className="spinner" />
  if (!data) return null

  const songs = data.songs

  function shuffleAll() {
    if (!songs.length) return
    if (!shuffle) toggleShuffle()
    playQueue(songs, Math.floor(Math.random() * songs.length))
  }

  return (
    <div className="content fade-up">
      <div className="hero">
        {data.coverArt ? (
          <Cover coverArt={data.coverArt} size={420} className="hero-art" alt={data.name} />
        ) : (
          <div className="hero-art" style={{ display: "grid", placeItems: "center", background: "linear-gradient(150deg, var(--surface-3), var(--surface))" }}>
            <User size={80} color="var(--accent)" />
          </div>
        )}
        <div className="hero-meta">
          <span className="hero-kicker">Artist</span>
          <h1 className="hero-title">{data.name}</h1>
          <p className="hero-sub">{formatCount(songs.length, "track")}</p>
        </div>
      </div>

      {songs.length > 0 ? (
        <div className="list-actions" style={{ marginBottom: 8 }}>
          <button className="btn-primary list-play" onClick={() => playQueue(songs, 0)}>
            <Play size={18} fill="currentColor" />
            Play
          </button>
          <button className="chip-btn" onClick={shuffleAll}>
            <Shuffle size={17} />
            Shuffle
          </button>
        </div>
      ) : null}

      <TrackList songs={songs} />
    </div>
  )
}
