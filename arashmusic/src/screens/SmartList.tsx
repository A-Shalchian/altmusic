import { Clock3, Play, Sparkles, TrendingUp } from "lucide-react"
import { useParams } from "react-router-dom"
import { TrackList } from "../components/TrackList"
import { useEntireLibrary } from "../queries/music"
import { usePlayerStore } from "../store/playerStore"
import { formatCount } from "../lib/format"
import type { Song } from "../api/types"

interface RuleConfig {
  title: string
  kicker: string
  icon: JSX.Element
  compute: (songs: Song[]) => Song[]
}

const RULES: Record<string, RuleConfig> = {
  recent: {
    title: "Recently Added",
    kicker: "Smart mix",
    icon: <Sparkles size={80} color="#1a1205" />,
    compute: (songs) =>
      [...songs].sort((a, b) => (b.created || "").localeCompare(a.created || "")).slice(0, 100)
  },
  "most-played": {
    title: "Most Played",
    kicker: "Smart mix",
    icon: <TrendingUp size={80} color="#1a1205" />,
    compute: (songs) =>
      songs.filter((s) => (s.playCount ?? 0) > 0).sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0)).slice(0, 100)
  },
  "never-played": {
    title: "Never Played",
    kicker: "Smart mix",
    icon: <Clock3 size={80} color="#1a1205" />,
    compute: (songs) => songs.filter((s) => !(s.playCount ?? 0)).slice(0, 100)
  }
}

export function SmartList() {
  const { rule } = useParams()
  const config = RULES[rule || "recent"] || RULES.recent
  const { data, isLoading } = useEntireLibrary()
  const playQueue = usePlayerStore((s) => s.playQueue)

  const songs = data ? config.compute(data) : []

  return (
    <div className="content fade-up">
      <div className="hero">
        <div
          className="hero-art"
          style={{ display: "grid", placeItems: "center", background: "linear-gradient(150deg, var(--accent), var(--accent-deep))" }}
        >
          {config.icon}
        </div>
        <div className="hero-meta">
          <span className="hero-kicker">{config.kicker}</span>
          <h1 className="hero-title">{config.title}</h1>
          <p className="hero-sub">{formatCount(songs.length, "track")}</p>
        </div>
      </div>

      {songs.length > 0 ? (
        <button
          className="btn-primary list-play"
          style={{ marginBottom: 8 }}
          onClick={() => playQueue(songs, 0)}
        >
          <Play size={18} fill="currentColor" />
          Play
        </button>
      ) : null}

      {isLoading ? <div className="spinner" /> : <TrackList songs={songs} />}
    </div>
  )
}
