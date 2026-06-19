import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { ListMusic, Pencil, Play, Trash2 } from "lucide-react"
import { deletePlaylist, renamePlaylist, reorderPlaylist } from "../api/subsonic"
import { Cover } from "../components/Cover"
import { TrackList } from "../components/TrackList"
import { usePlaylist } from "../queries/music"
import { usePlayerStore } from "../store/playerStore"
import { formatCount, formatTime } from "../lib/format"

export function PlaylistView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: playlist, isLoading } = usePlaylist(id)
  const playQueue = usePlayerStore((s) => s.playQueue)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")

  if (isLoading) return <div className="spinner" />
  if (!playlist) return null

  const songs = playlist.entry ?? []
  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration ?? 0), 0)

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || !id) {
      setEditing(false)
      return
    }
    try {
      await renamePlaylist(id, trimmed)
      queryClient.invalidateQueries({ queryKey: ["playlist", id] })
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
    } catch (error) {
      window.alert("Could not rename: " + (error as Error).message)
    }
    setEditing(false)
  }

  async function remove() {
    if (!id) return
    if (!window.confirm("Delete this playlist? The songs stay in your library.")) return
    try {
      await deletePlaylist(id)
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
      navigate("/playlists")
    } catch (error) {
      window.alert("Could not delete: " + (error as Error).message)
    }
  }

  return (
    <div className="content fade-up">
      <div className="hero">
        {playlist.coverArt ? (
          <Cover coverArt={playlist.coverArt} size={420} className="hero-art" alt={playlist.name} />
        ) : (
          <div
            className="hero-art"
            style={{ display: "grid", placeItems: "center", background: "linear-gradient(150deg, var(--surface-3), var(--surface))" }}
          >
            <ListMusic size={80} color="var(--accent)" />
          </div>
        )}
        <div className="hero-meta">
          <span className="hero-kicker">Playlist</span>
          {editing ? (
            <input
              className="hero-edit"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName()
                if (e.key === "Escape") setEditing(false)
              }}
            />
          ) : (
            <h1 className="hero-title">{playlist.name}</h1>
          )}
          <p className="hero-sub">
            {formatCount(songs.length, "track")} . {formatTime(totalSeconds)}
          </p>
        </div>
      </div>

      <div className="list-actions" style={{ marginBottom: 8 }}>
        {songs.length > 0 ? (
          <button className="btn-primary list-play" onClick={() => playQueue(songs, 0)}>
            <Play size={18} fill="currentColor" />
            Play
          </button>
        ) : null}
        <button
          className="round-btn"
          onClick={() => {
            setName(playlist.name)
            setEditing(true)
          }}
          aria-label="Rename"
        >
          <Pencil size={17} />
        </button>
        <button className="round-btn" onClick={remove} aria-label="Delete playlist">
          <Trash2 size={17} />
        </button>
      </div>

      {songs.length === 0 ? (
        <div className="empty">
          <ListMusic size={40} />
          <h3>This playlist is empty</h3>
          <p>Open a song menu and choose "Add to playlist" to fill it up.</p>
        </div>
      ) : (
        <TrackList
          songs={songs}
          playlistId={id}
          onReorder={async (orderedIds) => {
            if (!id) return
            try {
              await reorderPlaylist(id, orderedIds, songs.length)
              queryClient.invalidateQueries({ queryKey: ["playlist", id] })
            } catch (error) {
              window.alert("Could not reorder: " + (error as Error).message)
            }
          }}
        />
      )}
    </div>
  )
}
