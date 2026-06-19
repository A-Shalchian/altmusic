import type * as React from "react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowDownToLine, Check, Clock, Heart, HeartOff, ListMusic, ListPlus, ListStart, ListX, MoreVertical, Pause, Play, Trash2 } from "lucide-react"
import type { Song } from "../api/types"
import { deleteSong, removeFromPlaylist, star, streamUrl, unstar } from "../api/subsonic"
import { downloadForOffline, removeOffline } from "../lib/offline"
import { usePlayerStore } from "../store/playerStore"
import { useOfflineStore } from "../store/offlineStore"
import { formatTime } from "../lib/format"
import { AddToPlaylistModal } from "./AddToPlaylistModal"
import { Cover } from "./Cover"
import { Menu } from "./Menu"
import type { MenuItem } from "./Menu"

interface TrackListProps {
  songs: Song[]
  showAlbum?: boolean
  playlistId?: string
  onReorder?: (orderedIds: string[]) => void
}

interface MenuState {
  x: number
  y: number
  song: Song
  index: number
}

export function TrackList({ songs, showAlbum = true, playlistId, onReorder }: TrackListProps) {
  const queryClient = useQueryClient()
  const playQueue = usePlayerStore((s) => s.playQueue)
  const enqueue = usePlayerStore((s) => s.enqueue)
  const playNext = usePlayerStore((s) => s.playNext)
  const toggle = usePlayerStore((s) => s.toggle)
  const playing = usePlayerStore((s) => s.playing)
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id)

  const offlineItems = useOfflineStore((s) => s.items)
  const addOffline = useOfflineStore((s) => s.add)
  const removeOfflineId = useOfflineStore((s) => s.remove)
  const offlineIds = offlineItems.map((i) => i.id)

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [addSong, setAddSong] = useState<Song | null>(null)
  const [localOrder, setLocalOrder] = useState<Song[] | null>(null)
  const dragFrom = useRef<number | null>(null)

  useEffect(() => {
    setLocalOrder(null)
  }, [songs])

  function doReorder(to: number) {
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null || from === to || !onReorder) return
    const arr = (localOrder ?? songs).slice()
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    setLocalOrder(arr)
    onReorder(arr.map((s) => s.id))
  }

  async function toggleOffline(song: Song) {
    if (offlineIds.includes(song.id)) {
      await removeOffline(song.id)
      removeOfflineId(song.id)
      return
    }
    try {
      const size = await downloadForOffline(song.id, streamUrl(song.id))
      addOffline({ id: song.id, title: song.title, artist: song.artist || "", coverArt: song.coverArt, size })
    } catch (error) {
      window.alert("Could not download: " + (error as Error).message)
    }
  }

  const visible = (localOrder ?? songs).filter((song) => !hidden.has(song.id))

  function onRow(song: Song, index: number) {
    if (song.id === currentId) toggle()
    else playQueue(songs, index)
  }

  function openMenu(song: Song, index: number, x: number, y: number) {
    setMenu({ song, index, x, y })
  }

  async function doDelete(song: Song) {
    setHidden((prev) => new Set(prev).add(song.id))
    try {
      await deleteSong(song)
      setTimeout(() => queryClient.invalidateQueries(), 1500)
    } catch (error) {
      setHidden((prev) => {
        const next = new Set(prev)
        next.delete(song.id)
        return next
      })
      window.alert("Could not delete: " + (error as Error).message)
    }
  }

  async function removeFromCurrentPlaylist(song: Song, index: number) {
    if (!playlistId) return
    setHidden((prev) => new Set(prev).add(song.id))
    try {
      await removeFromPlaylist(playlistId, index)
      queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] })
    } catch (error) {
      setHidden((prev) => {
        const next = new Set(prev)
        next.delete(song.id)
        return next
      })
      window.alert("Could not remove: " + (error as Error).message)
    }
  }

  async function toggleStar(song: Song) {
    try {
      if (song.starred) await unstar(song.id)
      else await star(song.id)
      queryClient.invalidateQueries({ queryKey: ["starred"] })
    } catch (error) {
      void error
    }
  }

  function buildItems(state: MenuState): MenuItem[] {
    const song = state.song
    const items: MenuItem[] = [
      { label: "Play", icon: <Play size={16} />, onClick: () => playQueue(songs, state.index) },
      { label: "Play next", icon: <ListStart size={16} />, onClick: () => playNext(song) },
      { label: "Add to queue", icon: <ListPlus size={16} />, onClick: () => enqueue([song]) },
      { label: "Add to playlist", icon: <ListMusic size={16} />, onClick: () => setAddSong(song) }
    ]
    if (playlistId) {
      items.push({
        label: "Remove from this playlist",
        icon: <ListX size={16} />,
        onClick: () => removeFromCurrentPlaylist(song, state.index)
      })
    }
    items.push({
      label: song.starred ? "Remove from favorites" : "Add to favorites",
      icon: song.starred ? <HeartOff size={16} /> : <Heart size={16} />,
      onClick: () => toggleStar(song)
    })
    items.push({
      label: offlineIds.includes(song.id) ? "Remove download" : "Download for offline",
      icon: offlineIds.includes(song.id) ? <Check size={16} /> : <ArrowDownToLine size={16} />,
      onClick: () => toggleOffline(song)
    })
    items.push({
      label: "Delete from library",
      icon: <Trash2 size={16} />,
      onClick: () => doDelete(song),
      danger: true
    })
    return items
  }

  return (
    <div className="track-list">
      <div className="track-head">
        <span>#</span>
        <span>Title</span>
        <span>{showAlbum ? "Album" : ""}</span>
        <span style={{ textAlign: "right" }}>
          <Clock size={15} style={{ verticalAlign: "middle" }} />
        </span>
      </div>
      {visible.map((song, index) => {
        const realIndex = songs.indexOf(song)
        return (
          <TrackRow
            key={song.id + index}
            song={song}
            index={index}
            active={song.id === currentId}
            playing={playing && song.id === currentId}
            showAlbum={showAlbum}
            offline={offlineIds.includes(song.id)}
            reorderable={Boolean(onReorder)}
            onReorderStart={() => {
              dragFrom.current = index
            }}
            onReorderDrop={() => doReorder(index)}
            onClick={() => onRow(song, realIndex)}
            onContext={(x, y) => openMenu(song, realIndex, x, y)}
            onKebab={(x, y) => openMenu(song, realIndex, x, y)}
          />
        )
      })}
      {menu ? (
        <Menu x={menu.x} y={menu.y} items={buildItems(menu)} onClose={() => setMenu(null)} />
      ) : null}
      {addSong ? <AddToPlaylistModal song={addSong} onClose={() => setAddSong(null)} /> : null}
    </div>
  )
}

interface TrackRowProps {
  song: Song
  index: number
  active: boolean
  playing: boolean
  showAlbum: boolean
  offline: boolean
  reorderable: boolean
  onReorderStart: () => void
  onReorderDrop: () => void
  onClick: () => void
  onContext: (x: number, y: number) => void
  onKebab: (x: number, y: number) => void
}

function TrackRow({ song, index, active, playing, showAlbum, offline, reorderable, onReorderStart, onReorderDrop, onClick, onContext, onKebab }: TrackRowProps) {
  const [hover, setHover] = useState(false)
  const navigate = useNavigate()

  function onContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    onContext(event.clientX, event.clientY)
  }

  function onKebabClick(event: React.MouseEvent) {
    event.stopPropagation()
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    onKebab(rect.right - 6, rect.bottom + 6)
  }

  return (
    <div
      className={"track-row" + (active ? " active" : "")}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-song-id", song.id)
        onReorderStart()
      }}
      onDragOver={reorderable ? (e) => e.preventDefault() : undefined}
      onDrop={reorderable ? () => onReorderDrop() : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="track-index">
        {hover || active ? (
          playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />
        ) : (
          index + 1
        )}
      </div>
      <div className="track-main">
        <Cover coverArt={song.coverArt} size={80} className="track-art" alt={song.title} />
        <div style={{ minWidth: 0 }}>
          <div className="track-title">{song.title}</div>
          <div
            className={"track-artist" + (song.artistId ? " linkable" : "")}
            onClick={(e) => {
              if (!song.artistId) return
              e.stopPropagation()
              navigate("/artist/" + song.artistId)
            }}
          >
            {song.artist || "Unknown artist"}
          </div>
        </div>
      </div>
      <div className="track-album">{showAlbum ? song.album : ""}</div>
      <div className="track-meta">
        {offline ? <ArrowDownToLine size={14} className="track-offline" /> : null}
        {song.starred ? <Heart size={15} className="track-star" fill="currentColor" /> : null}
        <span>{formatTime(song.duration ?? 0)}</span>
        <button className="icon-btn track-kebab" onClick={onKebabClick} aria-label="More">
          <MoreVertical size={17} />
        </button>
      </div>
    </div>
  )
}
