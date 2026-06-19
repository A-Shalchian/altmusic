import { Heart, ListMusic, Music2, Shuffle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getRandomSongs } from "../api/subsonic"
import { Cover } from "../components/Cover"
import { TrackList } from "../components/TrackList"
import { usePlaylists } from "../queries/music"
import { usePlayerStore } from "../store/playerStore"
import { useHistoryStore } from "../store/historyStore"
import { formatCount } from "../lib/format"

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function Home() {
  const navigate = useNavigate()
  const { data: playlists } = usePlaylists()
  const playQueue = usePlayerStore((s) => s.playQueue)
  const recent = useHistoryStore((s) => s.recent)

  async function shuffleAll() {
    const songs = await getRandomSongs(100)
    if (songs.length) playQueue(songs, 0)
  }

  return (
    <div className="content fade-up">
      <h1 className="greeting">{greeting()}</h1>

      <div className="tile-row">
        <button className="tile" onClick={() => navigate("/favorites")}>
          <span className="tile-icon liked">
            <Heart size={22} fill="#1a1205" color="#1a1205" />
          </span>
          Liked Songs
        </button>
        <button className="tile" onClick={shuffleAll}>
          <span className="tile-icon">
            <Shuffle size={20} />
          </span>
          Shuffle
        </button>
        <button className="tile" onClick={() => navigate("/songs")}>
          <span className="tile-icon">
            <Music2 size={20} />
          </span>
          All Songs
        </button>
      </div>

      {recent.length > 0 ? (
        <section>
          <div className="section-head">
            <h2 className="section-title">Recently played</h2>
          </div>
          <TrackList songs={recent.slice(0, 8)} />
        </section>
      ) : null}

      {playlists && playlists.length > 0 ? (
        <section>
          <div className="section-head">
            <h2 className="section-title">Your playlists</h2>
            <span className="section-link" onClick={() => navigate("/playlists")}>
              See all
            </span>
          </div>
          <div className="card-grid">
            {playlists.map((playlist) => (
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
        </section>
      ) : null}
    </div>
  )
}
