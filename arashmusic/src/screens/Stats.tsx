import { useMemo } from "react"
import { BarChart3, Clock, Music2, Users } from "lucide-react"
import { TrackList } from "../components/TrackList"
import { useEntireLibrary } from "../queries/music"
import type { Song } from "../api/types"

interface Stat {
  icon: JSX.Element
  value: string
  label: string
}

export function Stats() {
  const { data, isLoading } = useEntireLibrary()

  const computed = useMemo(() => {
    const songs = data ?? []
    let totalPlays = 0
    let totalSeconds = 0
    const artistPlays = new Map<string, number>()
    for (const song of songs) {
      const plays = song.playCount ?? 0
      totalPlays += plays
      totalSeconds += plays * (song.duration ?? 0)
      if (song.artist) artistPlays.set(song.artist, (artistPlays.get(song.artist) ?? 0) + plays)
    }
    const topSongs = [...songs]
      .filter((s) => (s.playCount ?? 0) > 0)
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
      .slice(0, 10)
    const topArtists = [...artistPlays.entries()]
      .filter(([, plays]) => plays > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    return { songs, totalPlays, totalSeconds, topSongs, topArtists }
  }, [data])

  const minutes = Math.round(computed.totalSeconds / 60)
  const artistCount = useMemo(() => {
    const set = new Set((data ?? []).map((s: Song) => s.artist).filter(Boolean))
    return set.size
  }, [data])

  const stats: Stat[] = [
    { icon: <BarChart3 size={22} />, value: computed.totalPlays.toLocaleString(), label: "Total plays" },
    { icon: <Clock size={22} />, value: minutes.toLocaleString(), label: "Minutes listened" },
    { icon: <Music2 size={22} />, value: computed.songs.length.toLocaleString(), label: "Tracks in library" },
    { icon: <Users size={22} />, value: artistCount.toLocaleString(), label: "Artists" }
  ]

  if (isLoading) return <div className="spinner" />

  return (
    <div className="content fade-up">
      <h1 className="greeting">Your Stats</h1>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {computed.topArtists.length > 0 ? (
        <section>
          <div className="section-head">
            <h2 className="section-title">Top artists</h2>
          </div>
          <div className="rank-list">
            {computed.topArtists.map(([artist, plays], i) => (
              <div key={artist} className="rank-row">
                <span className="rank-num">{i + 1}</span>
                <span className="rank-name">{artist}</span>
                <span className="rank-meta">{plays} plays</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {computed.topSongs.length > 0 ? (
        <section>
          <div className="section-head">
            <h2 className="section-title">Top songs</h2>
          </div>
          <TrackList songs={computed.topSongs} />
        </section>
      ) : (
        <div className="empty">
          <BarChart3 size={40} />
          <h3>No plays yet</h3>
          <p>Listen to some music and your stats will fill in here.</p>
        </div>
      )}
    </div>
  )
}
