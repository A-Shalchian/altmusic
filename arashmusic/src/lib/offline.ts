const CACHE_NAME = "arashmusic-offline"

function key(id: string): string {
  return "/offline/" + id
}

export async function downloadForOffline(id: string, url: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Download failed (" + res.status + ")")
  const cache = await caches.open(CACHE_NAME)
  await cache.put(key(id), res)
}

export async function getOfflineUrl(id: string): Promise<string | null> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const res = await cache.match(key(id))
    if (!res) return null
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch (e) {
    void e
    return null
  }
}

export async function removeOffline(id: string): Promise<void> {
  const cache = await caches.open(CACHE_NAME)
  await cache.delete(key(id))
}
