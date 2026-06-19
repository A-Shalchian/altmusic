import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Minus, Plus } from "lucide-react"
import { getLyrics } from "../api/subsonic"
import { usePlayerStore } from "../store/playerStore"

interface LyricsViewProps {
  songId: string
}

export function LyricsView({ songId }: LyricsViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["lyrics", songId],
    queryFn: () => getLyrics(songId),
    enabled: Boolean(songId),
    staleTime: Infinity
  })
  const progress = usePlayerStore((s) => s.progress)
  const activeRef = useRef<HTMLParagraphElement | null>(null)

  const [langIndex, setLangIndex] = useState(0)
  const [nudge, setNudge] = useState(0)

  useEffect(() => {
    setLangIndex(0)
    setNudge(0)
  }, [songId])

  const versions = data ?? []
  const chosen = versions[langIndex] || versions.find((v) => v.synced) || versions[0]
  const lines = chosen?.line ?? []
  const offset = (chosen?.offset ?? 0) + nudge * 1000
  const synced = Boolean(chosen?.synced) && lines.some((line) => line.start != null)

  const activeIndex = useMemo(() => {
    if (!synced) return -1
    const ms = progress * 1000
    let idx = -1
    for (let i = 0; i < lines.length; i++) {
      const start = (lines[i].start ?? 0) + offset
      if (start <= ms) idx = i
      else break
    }
    return idx
  }, [progress, synced, lines, offset])

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [activeIndex])

  if (isLoading) return <div className="lyrics-empty">Loading lyrics</div>
  if (!lines.length) return <div className="lyrics-empty">No lyrics found for this track</div>

  const languages = versions.filter((v) => v.lang && v.lang !== "xxx")

  return (
    <div className="lyrics-wrap">
      <div className="lyrics-controls">
        {languages.length > 1 ? (
          <div className="lyrics-langs">
            {versions.map((v, i) => (
              <button
                key={i}
                className={"lang-chip" + (i === langIndex ? " on" : "")}
                onClick={() => setLangIndex(i)}
              >
                {(v.lang || "und").toUpperCase()}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {synced ? (
          <div className="lyrics-sync">
            <button className="icon-btn" onClick={() => setNudge((n) => n - 0.5)} aria-label="Lyrics earlier">
              <Minus size={15} />
            </button>
            <span className="sync-val">
              {nudge > 0 ? "+" : ""}
              {nudge.toFixed(1)}s
            </span>
            <button className="icon-btn" onClick={() => setNudge((n) => n + 0.5)} aria-label="Lyrics later">
              <Plus size={15} />
            </button>
          </div>
        ) : null}
      </div>

      <div className={"lyrics" + (synced ? " synced" : "")}>
        {lines.map((line, i) => (
          <p
            key={i}
            ref={i === activeIndex ? activeRef : null}
            className={
              "lyric-line" +
              (synced ? (i === activeIndex ? " active" : i < activeIndex ? " past" : "") : "")
            }
          >
            {line.value || " "}
          </p>
        ))}
      </div>
    </div>
  )
}
