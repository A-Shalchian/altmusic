import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getDiscoverMix } from "../api/manage"
import { getPlaylists, saveSongsToPlaylist } from "../api/subsonic"
import { useAuthStore } from "../store/authStore"

const MIX_NAME = "Discover Mix"

function syncedKey(username: string): string {
  return "arashmusic-mix-synced-" + username
}

// the server builds each user's mix overnight but has no way to act as that
// user, so the app writes it into a playlist the signed-in user owns
export async function syncDiscoverMix(username: string): Promise<boolean> {
  const mix = await getDiscoverMix()
  if (!mix.generatedAt || !mix.songIds.length) return false
  let synced = ""
  try {
    synced = localStorage.getItem(syncedKey(username)) ?? ""
  } catch {
    synced = ""
  }
  if (synced === String(mix.generatedAt)) return false

  const playlists = await getPlaylists()
  const existing = playlists.find((p) => p.name === MIX_NAME && p.owner === username)
  try {
    await saveSongsToPlaylist(MIX_NAME, mix.songIds, existing?.id)
  } catch (error) {
    // the pre-multi-user mix was imported from an .m3u and may be read-only
    if (!existing) throw error
    await saveSongsToPlaylist(MIX_NAME, mix.songIds)
  }
  try {
    localStorage.setItem(syncedKey(username), String(mix.generatedAt))
  } catch {
    void 0
  }
  return true
}

export function useDiscoverMixSync() {
  const queryClient = useQueryClient()
  const username = useAuthStore((s) => s.username)

  useEffect(() => {
    if (!username) return
    syncDiscoverMix(username)
      .then((changed) => {
        if (changed) queryClient.invalidateQueries({ queryKey: ["playlists"] })
      })
      .catch(() => undefined)
  }, [username, queryClient])
}
