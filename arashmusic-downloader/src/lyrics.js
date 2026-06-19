const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const ROOT = path.resolve(__dirname, "..")
const FFPROBE = path.join(ROOT, "tools", "ffprobe.exe")
const USER_AGENT = "arashmusic/0.1.0 (https://github.com/arash/arashmusic)"
const BASE = "https://lrclib.net/api"

function probe(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      resolve(null)
      return
    }
    const child = spawn(FFPROBE, ["-v", "quiet", "-print_format", "json", "-show_format", filePath])
    let out = ""
    child.stdout.on("data", (chunk) => {
      out += chunk
    })
    child.on("error", () => resolve(null))
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out)
        const tags = (parsed.format && parsed.format.tags) || {}
        const lower = {}
        for (const key in tags) lower[key.toLowerCase()] = tags[key]
        resolve({
          duration: parsed.format && parsed.format.duration ? Math.round(parseFloat(parsed.format.duration)) : 0,
          title: lower.title || "",
          artist: lower.artist || lower.album_artist || "",
          album: lower.album || ""
        })
      } catch (e) {
        void e
        resolve(null)
      }
    })
  })
}

function closestWithSync(candidates, duration) {
  let best = null
  for (const candidate of candidates) {
    if (!candidate.syncedLyrics && !candidate.plainLyrics) continue
    if (!best) {
      best = candidate
      continue
    }
    if (candidate.syncedLyrics && !best.syncedLyrics) {
      best = candidate
      continue
    }
    const bestGap = Math.abs((best.duration || 0) - duration)
    const candGap = Math.abs((candidate.duration || 0) - duration)
    if (candGap < bestGap) best = candidate
  }
  return best
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function cleanArtist(artist) {
  return artist
    .replace(/\s*-\s*topic$/i, "")
    .replace(/\s*vevo$/i, "")
    .replace(/\s*official$/i, "")
    .trim()
}

function cleanTitle(title, artist) {
  let value = title
  value = value.replace(
    /\s*[([][^)\]]*(official|lyric|audio|video|visualizer|visualiser|hd|hq|m\/?v|explicit|remaster|prod|free)[^)\]]*[)\]]/gi,
    ""
  )
  value = value.replace(/\s*(ft\.?|feat\.?)\s+.*$/i, "")
  if (artist) {
    const re = new RegExp("^\\s*" + escapeRegex(artist) + "\\s*[-–—:]\\s*", "i")
    value = value.replace(re, "")
  }
  return value.replace(/\s{2,}/g, " ").trim()
}

async function getExact(artist, title, album, duration, headers) {
  const params = new URLSearchParams({ track_name: title, artist_name: artist })
  if (album) params.set("album_name", album)
  if (duration) params.set("duration", String(duration))
  try {
    const res = await fetch(BASE + "/get?" + params.toString(), { headers })
    if (res.ok) {
      const data = await res.json()
      if (data && data.instrumental) return { instrumental: true }
      if (data && (data.syncedLyrics || data.plainLyrics)) return data
    }
  } catch (e) {
    void e
  }
  return null
}

async function searchBest(artist, title, duration, headers) {
  const params = new URLSearchParams({ track_name: title })
  if (artist) params.set("artist_name", artist)
  try {
    const res = await fetch(BASE + "/search?" + params.toString(), { headers })
    if (res.ok) {
      const arr = await res.json()
      if (Array.isArray(arr) && arr.length) return closestWithSync(arr, duration)
    }
  } catch (e) {
    void e
  }
  return null
}

async function lookup(meta) {
  const headers = { "User-Agent": USER_AGENT }
  const artist = cleanArtist(meta.artist)
  const title = cleanTitle(meta.title, meta.artist)

  const pairs = [[artist, title]]
  const dash = title.split(/\s[-–—]\s/)
  if (dash.length === 2) pairs.push([dash[0].trim(), dash[1].trim()])

  for (const [a, t] of pairs) {
    if (!a || !t) continue
    const data = await getExact(a, t, meta.album, meta.duration, headers)
    if (data) return data
  }
  for (const [a, t] of pairs) {
    if (!t) continue
    const data = await searchBest(a, t, meta.duration, headers)
    if (data) return data
  }
  return null
}

function sidecarPaths(filePath) {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath, path.extname(filePath))
  return { lrc: path.join(dir, base + ".lrc"), txt: path.join(dir, base + ".txt") }
}

function hasLyrics(filePath) {
  const paths = sidecarPaths(filePath)
  return fs.existsSync(paths.lrc) || fs.existsSync(paths.txt)
}

async function fetchAndWriteLyrics(filePath) {
  if (hasLyrics(filePath)) return "exists"
  const meta = await probe(filePath)
  if (!meta || !meta.title || !meta.artist) return "no-meta"
  const data = await lookup(meta)
  if (!data || data.instrumental) return "none"
  const paths = sidecarPaths(filePath)
  if (data.syncedLyrics) {
    fs.writeFileSync(paths.lrc, data.syncedLyrics, "utf8")
    return "synced"
  }
  if (data.plainLyrics) {
    fs.writeFileSync(paths.txt, data.plainLyrics, "utf8")
    return "plain"
  }
  return "none"
}

module.exports = { fetchAndWriteLyrics, hasLyrics, probe, sidecarPaths }
