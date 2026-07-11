import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowDownToLine, Check, Globe, Loader2, Search as SearchIcon } from "lucide-react"
import { TrackList } from "../components/TrackList"
import { useSearch, useWebSearch } from "../queries/music"
import { startWebDownload, waitForJob } from "../api/manage"
import type { WebResult } from "../api/manage"
import { startScan } from "../api/subsonic"

type GrabStatus = "downloading" | "done" | "error"

export function Search() {
  const queryClient = useQueryClient()
  const [term, setTerm] = useState("")
  const [debounced, setDebounced] = useState("")
  const [webTerm, setWebTerm] = useState("")
  const [grabs, setGrabs] = useState<Record<string, { status: GrabStatus; error?: string }>>({})

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 280)
    return () => clearTimeout(id)
  }, [term])

  const { data, isFetching } = useSearch(debounced)
  const web = useWebSearch(webTerm)

  function searchWeb() {
    const q = term.trim()
    if (q.length > 1) setWebTerm(q)
  }

  function setGrab(id: string, status: GrabStatus, error?: string) {
    setGrabs((prev) => ({ ...prev, [id]: { status, error } }))
  }

  async function grab(result: WebResult) {
    setGrab(result.id, "downloading")
    try {
      const jobId = await startWebDownload(result.id)
      const job = await waitForJob(jobId)
      if (job.status === "error") throw new Error(job.error || "Download failed")
      setGrab(result.id, "done")
      startScan().catch(() => undefined)
      setTimeout(() => queryClient.invalidateQueries(), 3000)
      setTimeout(() => queryClient.invalidateQueries(), 10000)
    } catch (error) {
      setGrab(result.id, "error", (error as Error).message)
    }
  }

  return (
    <div className="content fade-up">
      <div className="search-bar" style={{ marginTop: 8 }}>
        <SearchIcon size={19} color="var(--text-faint)" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") searchWeb()
          }}
          placeholder="Songs and artists"
          autoFocus
        />
      </div>

      {isFetching ? <div className="spinner" /> : null}

      {data && data.song.length > 0 ? (
        <section>
          <div className="section-head">
            <h2 className="section-title">Songs</h2>
          </div>
          <TrackList songs={data.song} />
        </section>
      ) : null}

      {debounced && data && data.song.length === 0 && !isFetching ? (
        <div className="empty" style={{ padding: "34px 20px" }}>
          <h3>Nothing in your library for "{debounced}"</h3>
          <p>Search the internet below.</p>
        </div>
      ) : null}

      {term.trim().length > 1 && term.trim() !== webTerm ? (
        <button className="web-search-go" onClick={searchWeb}>
          <Globe size={17} />
          Search the internet for "{term.trim()}"
        </button>
      ) : null}

      {webTerm.length > 1 ? (
        <section>
          <div className="section-head">
            <h2 className="section-title">
              <Globe size={17} style={{ verticalAlign: "-2px", marginRight: 8 }} />
              From the internet
            </h2>
          </div>

          {web.isFetching ? <div className="spinner" style={{ margin: "30px auto" }} /> : null}

          {web.isError ? (
            <div className="empty" style={{ padding: "24px 20px" }}>
              <p>Web search failed: {(web.error as Error).message}</p>
            </div>
          ) : null}

          {web.data?.map((result) => (
            <WebRow
              key={result.id}
              result={result}
              grab={grabs[result.id]}
              onGrab={() => grab(result)}
            />
          ))}
        </section>
      ) : null}
    </div>
  )
}

interface WebRowProps {
  result: WebResult
  grab?: { status: GrabStatus; error?: string }
  onGrab: () => void
}

function WebRow({ result, grab, onGrab }: WebRowProps) {
  const status = grab?.status

  return (
    <div className="web-row">
      <div className="web-row-main">
        <div className="web-row-title">{result.title}</div>
        <div className="web-row-sub">
          {result.uploader || "Unknown"}
          {result.duration ? " · " + result.duration : ""}
          {status === "error" ? <span className="web-row-error"> · {grab?.error}</span> : null}
        </div>
      </div>
      {status === "downloading" ? (
        <button className="web-get" disabled>
          <Loader2 size={16} className="web-spin" />
          Adding
        </button>
      ) : status === "done" ? (
        <button className="web-get added" disabled>
          <Check size={16} />
          Added
        </button>
      ) : status === "error" ? (
        <button className="web-get retry" onClick={onGrab}>
          <AlertCircle size={16} />
          Retry
        </button>
      ) : (
        <button className="web-get" onClick={onGrab}>
          <ArrowDownToLine size={16} />
          Get
        </button>
      )}
    </div>
  )
}
