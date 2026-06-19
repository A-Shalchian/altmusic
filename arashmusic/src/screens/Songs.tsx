import { Play, Shuffle } from "lucide-react"
import { TrackList } from "../components/TrackList"
import { useAllSongs } from "../queries/music"
import { usePlayerStore } from "../store/playerStore"
import { formatCount } from "../lib/format"

export function Songs() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAllSongs()
  const playQueue = usePlayerStore((s) => s.playQueue)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)

  const songs = (data?.pages ?? []).flat()

  function shuffleAll() {
    if (!songs.length) return
    if (!shuffle) toggleShuffle()
    playQueue(songs, Math.floor(Math.random() * songs.length))
  }

  return (
    <div className="content fade-up">
      <div className="list-header">
        <div>
          <h1 className="greeting" style={{ padding: 0 }}>
            Songs
          </h1>
          <p className="hero-sub">
            {formatCount(songs.length, "song")}
            {hasNextPage ? "+" : ""}
          </p>
        </div>
        <div className="list-actions">
          <button className="btn-primary list-play" onClick={() => playQueue(songs, 0)} disabled={!songs.length}>
            <Play size={18} fill="currentColor" />
            Play
          </button>
          <button className="chip-btn" onClick={shuffleAll} disabled={!songs.length}>
            <Shuffle size={17} />
            Shuffle
          </button>
        </div>
      </div>

      {isLoading ? <div className="spinner" /> : <TrackList songs={songs} />}

      {hasNextPage ? (
        <button className="load-more" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading" : "Load more"}
        </button>
      ) : null}
    </div>
  )
}
