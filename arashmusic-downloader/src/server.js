const http = require("http")
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
const { loadConfig, searchSongs, downloadById, downloadInput } = require("./download")
const { downloadTrack } = require("./spotdl")
const { getRecommendations, trackKey, norm } = require("./recommend")
const { addToBlacklist, recordSearch } = require("./store")

const PORT = 4544
const JOB_TTL = 10 * 60 * 1000
const QUALITIES = ["320K", "192K", "128K", "0"]
const ROOT = path.resolve(__dirname, "..")
const STAGE_DIR = path.join(ROOT, "cache")
const STAGE_TTL = 7 * 24 * 60 * 60 * 1000

const jobs = new Map()
const prefetches = new Map()
let jobSeq = 0

function sanitizeName(name) {
  return String(name || "").replace(/[<>:"/\\|?*]/g, "_").trim() || "Unknown"
}

function grabQuery(artist, title) {
  return "ytsearch1:" + artist + " " + title + " audio"
}

function stageTemplate(key) {
  return path.join(STAGE_DIR, key, "%(title)s.%(ext)s")
}

function stagedFile(key) {
  const dir = path.join(STAGE_DIR, key)
  if (!fs.existsSync(dir)) return null
  const mp3 = fs.readdirSync(dir).find((f) => f.endsWith(".mp3"))
  return mp3 ? path.join(dir, mp3) : null
}

function moveStaged(key, artist, config) {
  const dir = path.join(STAGE_DIR, key)
  const mp3 = stagedFile(key)
  if (!mp3) return null
  const destDir = path.join(config.musicDir, sanitizeName(artist))
  fs.mkdirSync(destDir, { recursive: true })
  let moved = null
  for (const file of fs.readdirSync(dir)) {
    const target = path.join(destDir, file)
    fs.renameSync(path.join(dir, file), target)
    if (file.endsWith(".mp3")) moved = target
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return moved
}

function pruneStage() {
  if (!fs.existsSync(STAGE_DIR)) return
  const now = Date.now()
  for (const entry of fs.readdirSync(STAGE_DIR)) {
    const dir = path.join(STAGE_DIR, entry)
    try {
      if (now - fs.statSync(dir).mtimeMs > STAGE_TTL) fs.rmSync(dir, { recursive: true, force: true })
    } catch (e) {
      void e
    }
  }
}

// spotDL first (correct tags, clean "Artist - Title" filename); yt-dlp search
// only as fallback when Spotify has no match
function grabToStage(artist, title) {
  const key = trackKey(artist, title)
  return downloadTrack(artist, title, path.join(STAGE_DIR, key)).catch(() =>
    downloadInput(grabQuery(artist, title), "320K", null, stageTemplate(key))
  )
}

function startPrefetch(artist, title) {
  const key = trackKey(artist, title)
  if (prefetches.has(key) || stagedFile(key)) return
  const promise = grabToStage(artist, title)
    .catch(() => null)
    .finally(() => prefetches.delete(key))
  prefetches.set(key, promise)
}

function startPullJob(artist, title) {
  const id = String(++jobSeq)
  const job = { status: "downloading", file: null, error: null, startedAt: Date.now() }
  jobs.set(id, job)
  ;(async () => {
    const key = trackKey(artist, title)
    const inflight = prefetches.get(key)
    if (inflight) await inflight
    if (!stagedFile(key)) await grabToStage(artist, title)
    const config = loadConfig()
    const file = moveStaged(key, artist, config)
    if (!file) throw new Error("download produced no file")
    job.status = "done"
    job.file = path.basename(file)
  })()
    .catch((error) => {
      job.status = "error"
      job.error = error.message
    })
    .finally(() => {
      setTimeout(() => jobs.delete(id), JOB_TTL).unref()
    })
  return id
}

// web-search results get staged under an artist subfolder so the move
// can place them without knowing the artist up front
function ytStageTemplate(key) {
  return path.join(STAGE_DIR, key, "%(artist,uploader)s", "%(title)s.%(ext)s")
}

function stagedYtFile(key) {
  const dir = path.join(STAGE_DIR, key)
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir)) {
    const sub = path.join(dir, entry)
    if (!fs.statSync(sub).isDirectory()) continue
    const mp3 = fs.readdirSync(sub).find((f) => f.endsWith(".mp3"))
    if (mp3) return path.join(sub, mp3)
  }
  return null
}

function moveStagedYt(key, config) {
  const dir = path.join(STAGE_DIR, key)
  if (!fs.existsSync(dir)) return null
  let moved = null
  for (const entry of fs.readdirSync(dir)) {
    const sub = path.join(dir, entry)
    if (!fs.statSync(sub).isDirectory()) continue
    const destDir = path.join(config.musicDir, sanitizeName(entry))
    fs.mkdirSync(destDir, { recursive: true })
    for (const file of fs.readdirSync(sub)) {
      const target = path.join(destDir, file)
      fs.renameSync(path.join(sub, file), target)
      if (file.endsWith(".mp3")) moved = target
    }
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return moved
}

function startYtPrefetch(videoId) {
  const key = "yt-" + videoId
  if (prefetches.has(key) || stagedYtFile(key)) return
  const promise = downloadInput("https://www.youtube.com/watch?v=" + videoId, "320K", null, ytStageTemplate(key))
    .catch(() => null)
    .finally(() => prefetches.delete(key))
  prefetches.set(key, promise)
}

function startJob(videoId, quality) {
  const id = String(++jobSeq)
  const job = { status: "downloading", file: null, error: null, startedAt: Date.now() }
  jobs.set(id, job)
  ;(async () => {
    const key = "yt-" + videoId
    const inflight = prefetches.get(key)
    if (inflight) await inflight
    let file = null
    if (quality === "320K" && stagedYtFile(key)) file = moveStagedYt(key, loadConfig())
    if (!file) file = await downloadById(videoId, quality)
    job.status = "done"
    job.file = file ? path.basename(file) : null
  })()
    .catch((error) => {
      job.status = "error"
      job.error = error.message
    })
    .finally(() => {
      setTimeout(() => jobs.delete(id), JOB_TTL).unref()
    })
  return id
}

const DISCOVER_COUNT = 12
const DISCOVER_HOUR = 4
let discoverRunning = false

// nightly Spotify-free "Discover Weekly": pull top recommendations into the
// library and rewrite the Discover Mix playlist; Navidrome's 1-minute scan
// schedule imports both automatically
async function runDiscover() {
  if (discoverRunning) return
  discoverRunning = true
  try {
    const config = loadConfig()
    if (config.discover === false) return
    const data = await getRecommendations(config, true)

    // round-robin across sections so the mix isn't one artist cluster
    const picks = []
    for (let i = 0; picks.length < DISCOVER_COUNT; i++) {
      let added = false
      for (const section of data.sections) {
        if (picks.length >= DISCOVER_COUNT) break
        const track = section.tracks[i]
        if (track) {
          picks.push(track)
          added = true
        }
      }
      if (!added) break
    }

    const files = []
    for (const track of picks) {
      try {
        const key = trackKey(track.artist, track.title)
        if (!stagedFile(key)) await grabToStage(track.artist, track.title)
        const file = moveStaged(key, track.artist, config)
        if (file) files.push(file)
      } catch (error) {
        console.log("discover: skip " + track.artist + " - " + track.title + " (" + error.message + ")")
      }
    }

    if (files.length) {
      const lines = ["#EXTM3U", ...files.map((f) => path.relative(config.musicDir, f).split(path.sep).join("/"))]
      fs.writeFileSync(path.join(config.musicDir, "Discover Mix.m3u"), lines.join("\n"))
      console.log("discover: " + files.length + " new tracks in Discover Mix")
    }
  } finally {
    discoverRunning = false
  }
}

function scheduleDiscover() {
  const now = new Date()
  const next = new Date(now)
  next.setHours(DISCOVER_HOUR, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  setTimeout(() => {
    runDiscover().catch((e) => console.log("discover: " + e.message))
    setInterval(() => runDiscover().catch((e) => console.log("discover: " + e.message)), 24 * 60 * 60 * 1000).unref()
  }, next - now).unref()
}

function rowForId(dbPath, id) {
  if (!dbPath || !id || !fs.existsSync(dbPath)) return null
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return db.prepare("select path, artist, title from media_file where id = ?").get(id) || null
  } catch (e) {
    void e
    return null
  } finally {
    db.close()
  }
}

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" })
  res.end(JSON.stringify(obj))
}

function within(base, target) {
  const rel = path.relative(base, target)
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
}

function resolveTarget(musicDir, raw) {
  const value = String(raw || "")
  if (!value) return null
  if (path.isAbsolute(value)) return path.resolve(value)
  return path.resolve(musicDir, value.replace(/^[\/\\]+/, ""))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost")

  if (req.method === "GET" && url.pathname === "/manage/api/health") {
    send(res, 200, { ok: true })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/recommendations") {
    const config = loadConfig()
    getRecommendations(config, url.searchParams.get("refresh") === "1")
      .then((data) => send(res, 200, { ok: true, sections: data.sections }))
      .catch((error) => send(res, 500, { ok: false, error: error.message }))
    return
  }

  if (req.method === "POST" && (url.pathname === "/manage/api/pull" || url.pathname === "/manage/api/prefetch")) {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}")
        const artist = String(data.artist || "").trim()
        const title = String(data.title || "").trim()
        if (!artist || !title) {
          send(res, 400, { ok: false, error: "missing artist or title" })
          return
        }
        if (url.pathname === "/manage/api/prefetch") {
          startPrefetch(artist, title)
          send(res, 200, { ok: true })
        } else {
          send(res, 200, { ok: true, jobId: startPullJob(artist, title) })
        }
      } catch (error) {
        send(res, 500, { ok: false, error: error.message })
      }
    })
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/discover/run") {
    const wasRunning = discoverRunning
    runDiscover().catch((e) => console.log("discover: " + e.message))
    send(res, 200, { ok: true, started: !wasRunning })
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/dismiss") {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}")
        const artist = String(data.artist || "").trim()
        const title = String(data.title || "").trim()
        if (!artist) {
          send(res, 400, { ok: false, error: "missing artist" })
          return
        }
        addToBlacklist(norm(artist) + "|" + (title ? norm(title) : "*"))
        send(res, 200, { ok: true })
      } catch (error) {
        send(res, 500, { ok: false, error: error.message })
      }
    })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/search") {
    const query = (url.searchParams.get("q") || "").trim()
    if (!query) {
      send(res, 400, { ok: false, error: "missing q" })
      return
    }
    recordSearch(query)
    searchSongs(query, 10)
      .then((results) => {
        // speculatively stage the top hit so tapping Get is instant
        if (results[0]) startYtPrefetch(results[0].id)
        send(res, 200, { ok: true, results })
      })
      .catch((error) => send(res, 500, { ok: false, error: error.message }))
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/download") {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}")
        const videoId = String(data.id || "")
        if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
          send(res, 400, { ok: false, error: "invalid video id" })
          return
        }
        const quality = QUALITIES.includes(data.quality) ? data.quality : "320K"
        const jobId = startJob(videoId, quality)
        send(res, 200, { ok: true, jobId })
      } catch (error) {
        send(res, 500, { ok: false, error: error.message })
      }
    })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/job") {
    const job = jobs.get(url.searchParams.get("id") || "")
    if (!job) {
      send(res, 404, { ok: false, error: "job not found" })
      return
    }
    send(res, 200, { ok: true, status: job.status, file: job.file, error: job.error })
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/delete") {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      try {
        const config = loadConfig()
        const data = JSON.parse(body || "{}")
        const row = rowForId(config.navidromeDb, data.id)
        const target = resolveTarget(config.musicDir, (row && row.path) || data.path)
        if (!target || !within(config.musicDir, target)) {
          send(res, 400, { ok: false, error: "invalid path" })
          return
        }
        if (!fs.existsSync(target)) {
          send(res, 404, { ok: false, error: "file not found" })
          return
        }
        fs.unlinkSync(target)
        // deleted = never wanted; keep it out of future recommendations
        if (row && row.artist && row.title) addToBlacklist(norm(row.artist) + "|" + norm(row.title))
        const dir = path.dirname(target)
        try {
          if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
        } catch (e) {
          void e
        }
        send(res, 200, { ok: true })
      } catch (error) {
        send(res, 500, { ok: false, error: error.message })
      }
    })
    return
  }

  send(res, 404, { ok: false, error: "not found" })
})

pruneStage()
setInterval(pruneStage, 60 * 60 * 1000).unref()
scheduleDiscover()

server.listen(PORT, () => {
  console.log("arashmusic management server on port " + PORT)
})
