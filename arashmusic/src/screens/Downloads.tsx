import { ArrowDownToLine, HardDrive, Trash2, X } from "lucide-react"
import { removeOffline } from "../lib/offline"
import { useOfflineStore } from "../store/offlineStore"
import { Cover } from "../components/Cover"
import { formatBytes, formatCount } from "../lib/format"

export function Downloads() {
  const items = useOfflineStore((s) => s.items)
  const remove = useOfflineStore((s) => s.remove)
  const clear = useOfflineStore((s) => s.clear)

  const totalBytes = items.reduce((sum, item) => sum + (item.size || 0), 0)

  async function removeOne(id: string) {
    await removeOffline(id)
    remove(id)
  }

  async function clearAll() {
    if (!window.confirm("Remove all downloaded songs from this device?")) return
    for (const item of items) await removeOffline(item.id)
    clear()
  }

  return (
    <div className="content fade-up">
      <h1 className="greeting">Downloads</h1>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <ArrowDownToLine size={22} />
          </span>
          <div className="stat-value">{items.length}</div>
          <div className="stat-label">{items.length === 1 ? "song downloaded" : "songs downloaded"}</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <HardDrive size={22} />
          </span>
          <div className="stat-value">{formatBytes(totalBytes)}</div>
          <div className="stat-label">storage used</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <ArrowDownToLine size={40} />
          <h3>No downloads yet</h3>
          <p>Open a song menu and choose "Download for offline" to save it here.</p>
        </div>
      ) : (
        <>
          <div className="list-actions" style={{ margin: "20px 0 8px" }}>
            <button className="chip-btn" onClick={clearAll}>
              <Trash2 size={16} />
              Clear all
            </button>
            <span className="hero-sub">{formatCount(items.length, "track")} . {formatBytes(totalBytes)}</span>
          </div>
          <div className="track-list">
            {items.map((item) => (
              <div key={item.id} className="track-row" style={{ gridTemplateColumns: "1fr 80px 40px" }}>
                <div className="track-main">
                  <Cover coverArt={item.coverArt} size={80} className="track-art" alt={item.title} />
                  <div style={{ minWidth: 0 }}>
                    <div className="track-title">{item.title}</div>
                    <div className="track-artist">{item.artist || "Unknown artist"}</div>
                  </div>
                </div>
                <div className="track-meta">{formatBytes(item.size)}</div>
                <button className="icon-btn" onClick={() => removeOne(item.id)} aria-label="Remove download">
                  <X size={17} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
