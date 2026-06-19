import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
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

  const lines = data?.line ?? []
  const offset = data?.offset ?? 0
  const synced = Boolean(data?.synced) && lines.some((line) => line.start != null)

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

  return (
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
          {line.value || " "}
        </p>
      ))}
    </div>
  )
}
