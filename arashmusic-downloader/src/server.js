const http = require("http")
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
const { loadConfig, searchSongs, downloadById, downloadInput } = require("./download")
const { downloadTrack } = require("./spotdl")
const { getRecommendations, trackKey } = require("./recommend")

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

function startJob(videoId, quality) {
  const id = String(++jobSeq)
  const job = { status: "downloading", file: null, error: null, startedAt: Date.now() }
  jobs.set(id, job)
  downloadById(videoId, quality)
    .then((file) => {
      job.status = "done"
      job.file = file ? path.basename(file) : null
    })
    .catch((error) => {
      job.status = "error"
      job.error = error.message
    })
    .finally(() => {
      setTimeout(() => jobs.delete(id), JOB_TTL).unref()
    })
  return id
}

function pathForId(dbPath, id) {
  if (!dbPath || !id || !fs.existsSync(dbPath)) return null
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const row = db.prepare("select path from media_file where id = ?").get(id)
    return row ? row.path : null
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

  if (req.method === "GET" && url.pathname === "/manage/api/search") {
    const query = (url.searchParams.get("q") || "").trim()
    if (!query) {
      send(res, 400, { ok: false, error: "missing q" })
      return
    }
    searchSongs(query, 10)
      .then((results) => send(res, 200, { ok: true, results }))
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
        const dbPath = pathForId(config.navidromeDb, data.id)
        const target = resolveTarget(config.musicDir, dbPath || data.path)
        if (!target || !within(config.musicDir, target)) {
          send(res, 400, { ok: false, error: "invalid path" })
          return
        }
        if (!fs.existsSync(target)) {
          send(res, 404, { ok: false, error: "file not found" })
          return
        }
        fs.unlinkSync(target)
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

server.listen(PORT, () => {
  console.log("arashmusic management server on port " + PORT)
})
