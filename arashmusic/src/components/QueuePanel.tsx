import { useState } from "react"
import { GripVertical, Pause, Play, X } from "lucide-react"
import { usePlayerStore } from "../store/playerStore"
import { useUiStore } from "../store/uiStore"
import { Cover } from "./Cover"

export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue)
  const index = usePlayerStore((s) => s.index)
  const playing = usePlayerStore((s) => s.playing)
  const jumpTo = usePlayerStore((s) => s.jumpTo)
  const removeAt = usePlayerStore((s) => s.removeAt)
  const move = usePlayerStore((s) => s.move)
  const toggle = usePlayerStore((s) => s.toggle)
  const close = useUiStore((s) => s.closeQueue)

  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const current = queue[index]
  const upNext = queue.map((song, i) => ({ song, i })).filter((entry) => entry.i > index)

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      return
    }
    move(dragIndex, targetIndex)
    setDragIndex(null)
  }

  return (
    <aside className="queue-panel">
      <div className="queue-head">
        <h3>Queue</h3>
        <button className="round-btn" onClick={close} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="queue-scroll">
        {current ? (
          <div className="queue-section">
            <div className="queue-label">Now playing</div>
            <div className="queue-row active" onClick={toggle}>
              <div className="queue-grip" />
              <Cover coverArt={current.coverArt} size={80} className="queue-art" alt={current.title} />
              <div className="queue-text">
                <div className="queue-title">{current.title}</div>
                <div className="queue-artist">{current.artist || "Unknown artist"}</div>
              </div>
              <button className="icon-btn" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
            </div>
          </div>
        ) : null}

        <div className="queue-section">
          <div className="queue-label">Up next</div>
          {upNext.length === 0 ? (
            <div className="queue-empty">Nothing queued</div>
          ) : (
            upNext.map(({ song, i }) => (
              <div
                key={song.id + i}
                className={"queue-row" + (dragIndex === i ? " dragging" : "")}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onClick={() => jumpTo(i)}
              >
                <span className="queue-grip" onClick={(e) => e.stopPropagation()}>
                  <GripVertical size={16} />
                </span>
                <Cover coverArt={song.coverArt} size={80} className="queue-art" alt={song.title} />
                <div className="queue-text">
                  <div className="queue-title">{song.title}</div>
                  <div className="queue-artist">{song.artist || "Unknown artist"}</div>
                </div>
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAt(i)
                  }}
                  aria-label="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
