import { useEffect, useState } from "react"
import { Search as SearchIcon } from "lucide-react"
import { TrackList } from "../components/TrackList"
import { useSearch } from "../queries/music"

export function Search() {
  const [term, setTerm] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 280)
    return () => clearTimeout(id)
  }, [term])

  const { data, isFetching } = useSearch(debounced)

  return (
    <div className="content fade-up">
      <div className="search-bar" style={{ marginTop: 8 }}>
        <SearchIcon size={19} color="var(--text-faint)" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
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
        <div className="empty">
          <h3>No results for "{debounced}"</h3>
          <p>Try another spelling or a different term.</p>
        </div>
      ) : null}
    </div>
  )
}
