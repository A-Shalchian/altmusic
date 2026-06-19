import { useEffect, useState } from "react"
import {
  ChevronDown,
  Heart,
  ListMusic,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward
} from "lucide-react"
import { coverArtUrl, star, unstar } from "../api/subsonic"
import { usePlayerStore } from "../store/playerStore"
import { useUiStore } from "../store/uiStore"
import { extractColor } from "../lib/color"
import { formatTime } from "../lib/format"
import { Cover } from "./Cover"
import { LyricsView } from "./LyricsView"
import { Scrubber } from "./Scrubber"

export function NowPlaying() {
  const queue = usePlayerStore((s) => s.queue)
  const index = usePlayerStore((s) => s.index)
  const playing = usePlayerStore((s) => s.playing)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const repeat = usePlayerStore((s) => s.repeat)
  const progress = usePlayerStore((s) => s.progress)
  const duration = usePlayerStore((s) => s.duration)
  const toggle = usePlayerStore((s) => s.toggle)
  const nextTrack = usePlayerStore((s) => s.next)
  const prevTrack = usePlayerStore((s) => s.prev)
  const setProgress = usePlayerStore((s) => s.setProgress)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat)

  const close = useUiStore((s) => s.closeNowPlaying)
  const toggleQueue = useUiStore((s) => s.toggleQueue)

  const song = queue[index]
  const [bg, setBg] = useState("#1a1614")
  const [starred, setStarred] = useState(false)
  const [showLyrics, setShowLyrics] = useState(true)

  useEffect(() => {
    setStarred(Boolean(song?.starred))
    if (song?.coverArt) extractColor(coverArtUrl(song.coverArt, 64)).then(setBg)
    else setBg("#1a1614")
  }, [song?.id])

  if (!song) return null

  function seek(value: number) {
    setProgress(value)
    const audio = document.querySelector("audio")
    if (audio) audio.currentTime = value
  }

  async function toggleStar() {
    const nextValue = !starred
    setStarred(nextValue)
    try {
      if (nextValue) await star(song.id)
      else await unstar(song.id)
    } catch (e) {
      void e
      setStarred(!nextValue)
    }
  }

  return (
    <div className="np" style={{ background: "linear-gradient(170deg, " + bg + " 0%, #0b0a0c 62%)" }}>
      <div className="np-top">
        <button className="round-btn" onClick={close} aria-label="Close">
          <ChevronDown size={22} />
        </button>
        <span className="np-kicker">Now Playing</span>
        <button
          className={"round-btn" + (showLyrics ? " on" : "")}
          onClick={() => setShowLyrics((v) => !v)}
          aria-label="Lyrics"
        >
          <Mic2 size={18} />
        </button>
      </div>

      <div className={"np-body" + (showLyrics ? " with-lyrics" : "")}>
        <div className="np-stage">
          <Cover coverArt={song.coverArt} size={640} className="np-art" alt={song.title} />
          <div className="np-info">
            <div className="np-text">
              <h1 className="np-title">{song.title}</h1>
              <p className="np-artist">{song.artist || "Unknown artist"}</p>
            </div>
            <button className={"icon-btn" + (starred ? " starred" : "")} onClick={toggleStar} aria-label="Favorite">
              <Heart size={24} fill={starred ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="np-seek">
            <span className="seek-time">{formatTime(progress)}</span>
            <Scrubber value={progress} max={duration} onSeek={seek} />
            <span className="seek-time">{formatTime(duration)}</span>
          </div>

          <div className="np-controls">
            <button className={shuffle ? "active" : ""} onClick={toggleShuffle} aria-label="Shuffle">
              <Shuffle size={20} />
            </button>
            <button onClick={prevTrack} aria-label="Previous">
              <SkipBack size={26} fill="currentColor" />
            </button>
            <button className="np-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            <button onClick={nextTrack} aria-label="Next">
              <SkipForward size={26} fill="currentColor" />
            </button>
            <button className={repeat !== "off" ? "active" : ""} onClick={cycleRepeat} aria-label="Repeat">
              {repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          <button className="np-queue-btn" onClick={toggleQueue}>
            <ListMusic size={17} />
            Queue
          </button>
        </div>

        {showLyrics ? (
          <div className="np-lyrics">
            <LyricsView songId={song.id} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
