import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Music2, Play, RefreshCw, X } from "lucide-react"
import type { RecTrack } from "../api/manage"
import { dismissTrack, getRecommendations, prefetchTrack, pullTrack, waitForJob } from "../api/manage"
import { search, startScan } from "../api/subsonic"
import type { Song } from "../api/types"
import { useRecommendations } from "../queries/music"
import { usePlayerStore } from "../store/playerStore"

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function artistMatches(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  return x === y || x.includes(y) || y.includes(x)
}

async function findImported(fileName: string, track: RecTrack): Promise<Song | null> {
  const fromFile = fileName.replace(/\.mp3$/i, "")
  const queries = [track.artist + " " + track.title, fromFile]
  for (let attempt = 0; attempt < 15; attempt++) {
    for (const query of queries) {
      try {
        const result = await search(query)
        const match =
          result.song.find((s) => norm(s.title) === norm(fromFile)) ||
          result.song.find((s) => norm(s.title).includes(norm(track.title)) && artistMatches(s.artist || "", track.artist)) ||
          result.song.find((s) => norm(s.title).includes(norm(track.title)))
        if (match) return match
      } catch (error) {
        void error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  return null
}

export function DiscoverFeed() {
  const queryClient = useQueryClient()
  const playQueue = usePlayerStore((s) => s.playQueue)
  const { data: sections, isFetching, isError } = useRecommendations()
  const [busy, setBusy] = useState<Record<string, "getting" | "error">>({})
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const prefetched = useRef(false)

  useEffect(() => {
    if (!sections || !sections.length || prefetched.current) return
    prefetched.current = true
    for (const section of sections) {
      for (const track of section.tracks.slice(0, 2)) {
        prefetchTrack(track.artist, track.title)
      }
    }
  }, [sections])

  async function refresh() {
    setRefreshing(true)
    try {
      const fresh = await getRecommendations(true)
      queryClient.setQueryData(["recommendations"], fresh)
      prefetched.current = false
    } catch (error) {
      void error
    } finally {
      setRefreshing(false)
    }
  }

  function dismiss(event: React.MouseEvent, track: RecTrack) {
    event.stopPropagation()
    setHidden((prev) => new Set(prev).add(track.key))
    dismissTrack(track.artist, track.title)
  }

  async function grab(track: RecTrack) {
    if (busy[track.key] === "getting") return
    setBusy((prev) => ({ ...prev, [track.key]: "getting" }))
    try {
      const jobId = await pullTrack(track.artist, track.title)
      const job = await waitForJob(jobId)
      if (job.status === "error" || !job.file) throw new Error(job.error || "Download failed")
      startScan().catch(() => undefined)
      const song = await findImported(job.file, track)
      setBusy((prev) => {
        const next = { ...prev }
        delete next[track.key]
        return next
      })
      queryClient.invalidateQueries({ queryKey: ["search"] })
      queryClient.invalidateQueries({ queryKey: ["allSongs"] })
      if (song) playQueue([song], 0)
    } catch (error) {
      void error
      setBusy((prev) => ({ ...prev, [track.key]: "error" }))
    }
  }

  if (isError) return null
  if (!sections || !sections.length) {
    if (isFetching) return null
    return null
  }

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <section key={section.title}>
          <div className="section-head">
            <h2 className="section-title">{section.title}</h2>
            {sectionIndex === 0 ? (
              <span className="section-link" onClick={refreshing ? undefined : refresh}>
                <RefreshCw size={14} className={refreshing ? "web-spin" : undefined} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                Refresh
              </span>
            ) : null}
          </div>
          <div className="card-grid">
            {section.tracks.filter((track) => !hidden.has(track.key)).map((track) => {
              const state = busy[track.key]
              return (
                <div
                  key={track.key}
                  className={"card rec-card" + (state === "getting" ? " getting" : "")}
                  onClick={() => grab(track)}
                >
                  <div className="card-art-wrap">
                    {track.cover ? (
                      <img className="card-art" src={track.cover} alt={track.title} loading="lazy" />
                    ) : (
                      <div className="card-art" style={{ display: "grid", placeItems: "center" }}>
                        <Music2 size={46} color="var(--accent)" />
                      </div>
                    )}
                    <span className="rec-dismiss" title="Not interested" onClick={(e) => dismiss(e, track)}>
                      <X size={15} />
                    </span>
                    <span className="rec-play">
                      {state === "getting" ? (
                        <Loader2 size={20} className="web-spin" />
                      ) : (
                        <Play size={20} fill="currentColor" />
                      )}
                    </span>
                  </div>
                  <div className="card-title">{track.title}</div>
                  <div className="card-sub">
                    {state === "error" ? <span className="web-row-error">Failed — tap to retry</span> : track.artist}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
