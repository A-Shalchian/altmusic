import { ListMusic, Maximize2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react"
import { usePlayerStore } from "../store/playerStore"
import { useUiStore } from "../store/uiStore"
import { formatTime } from "../lib/format"
import { Cover } from "./Cover"
import { Scrubber } from "./Scrubber"

export function PlayerBar() {
  const queue = usePlayerStore((s) => s.queue)
  const index = usePlayerStore((s) => s.index)
  const playing = usePlayerStore((s) => s.playing)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const repeat = usePlayerStore((s) => s.repeat)
  const volume = usePlayerStore((s) => s.volume)
  const progress = usePlayerStore((s) => s.progress)
  const duration = usePlayerStore((s) => s.duration)
  const toggle = usePlayerStore((s) => s.toggle)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const setProgress = usePlayerStore((s) => s.setProgress)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat)
  const openNowPlaying = useUiStore((s) => s.openNowPlaying)
  const toggleQueue = useUiStore((s) => s.toggleQueue)

  const song = queue[index]

  function seek(value: number) {
    setProgress(value)
    const audio = document.querySelector("audio")
    if (audio) audio.currentTime = value
  }

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <footer className="player-bar">
      <div className={"now-playing" + (song ? " clickable" : "")} onClick={() => song && openNowPlaying()}>
        {song ? (
          <>
            <Cover coverArt={song.coverArt} size={120} className="now-art" alt={song.title} />
            <div className="now-text">
              <div className="now-title">{song.title}</div>
              <div className="now-artist">{song.artist || "Unknown artist"}</div>
            </div>
            <span className="now-expand">
              <Maximize2 size={15} />
            </span>
          </>
        ) : (
          <div className="now-text">
            <div className="now-title" style={{ color: "var(--text-faint)" }}>
              Nothing playing
            </div>
          </div>
        )}
      </div>

      <div className="player-center">
        <div className="transport">
          <button
            className={"shuffle-btn" + (shuffle ? " active" : "")}
            onClick={toggleShuffle}
            aria-label="Shuffle"
          >
            <Shuffle size={18} />
          </button>
          <button onClick={prev} aria-label="Previous">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="play-toggle" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button onClick={next} aria-label="Next">
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className={"repeat-btn" + (repeat !== "off" ? " active" : "")}
            onClick={cycleRepeat}
            aria-label="Repeat"
          >
            {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        <div className="seek">
          <span className="seek-time">{formatTime(progress)}</span>
          <Scrubber value={progress} max={duration} onSeek={seek} />
          <span className="seek-time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <button className="icon-btn" onClick={toggleQueue} aria-label="Queue">
          <ListMusic size={18} />
        </button>
        <VolumeIcon size={19} color="var(--text-dim)" />
        <div className="volume">
          <Scrubber value={volume} max={1} onSeek={setVolume} />
        </div>
      </div>
    </footer>
  )
}
