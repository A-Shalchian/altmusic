import { useState } from "react"
import { createPortal } from "react-dom"
import { useQueryClient } from "@tanstack/react-query"
import { ListMusic, Plus, X } from "lucide-react"
import type { Song } from "../api/types"
import { addToPlaylist, createPlaylist } from "../api/subsonic"
import { usePlaylists } from "../queries/music"

interface AddToPlaylistModalProps {
  song: Song
  onClose: () => void
}

export function AddToPlaylistModal({ song, onClose }: AddToPlaylistModalProps) {
  const queryClient = useQueryClient()
  const { data: playlists } = usePlaylists()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  async function addTo(playlistId: string) {
    setBusy(true)
    try {
      await addToPlaylist(playlistId, song.id)
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
      queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] })
      onClose()
    } catch (error) {
      window.alert("Could not add: " + (error as Error).message)
      setBusy(false)
    }
  }

  async function createAndAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      const id = await createPlaylist(trimmed)
      if (id) await addToPlaylist(id, song.id)
      queryClient.invalidateQueries({ queryKey: ["playlists"] })
      onClose()
    } catch (error) {
      window.alert("Could not create: " + (error as Error).message)
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Add to playlist</h3>
          <button className="round-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="modal-sub">{song.title}</p>

        {creating ? (
          <div className="modal-create">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Playlist name"
              onKeyDown={(e) => {
                if (e.key === "Enter") createAndAdd()
              }}
            />
            <button className="btn-primary" disabled={busy || !name.trim()} onClick={createAndAdd}>
              Create
            </button>
          </div>
        ) : (
          <button className="modal-row modal-new" onClick={() => setCreating(true)} disabled={busy}>
            <Plus size={18} />
            New playlist
          </button>
        )}

        <div className="modal-list">
          {(playlists ?? []).map((playlist) => (
            <button
              key={playlist.id}
              className="modal-row"
              onClick={() => addTo(playlist.id)}
              disabled={busy}
            >
              <ListMusic size={18} />
              <span>{playlist.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
