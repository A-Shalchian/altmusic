const http = require("http")
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
const { loadConfig, searchSongs, downloadById, downloadInput } = require("./download")
const { downloadTrack } = require("./spotdl")
const { getRecommendations, trackKey, norm } = require("./recommend")
const {
  migrateLegacy,
  addToBlacklist,
  addToGlobalBlacklist,
  recordSearch,
  saveDiscoverMix,
  getDiscoverMix
} = require("./store")
const { runFixTags, findPending, applyAnswers } = require("./fixtags")
const { verify, adminToken, navidromeApi, listUserIds, forgetUser } = require("./auth")
const { runBackup } = require("./backup")

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
const BACKUP_HOUR = 3
let discoverRunning = false

// round-robin across sections so the mix isn't one artist cluster
function pickRoundRobin(sections, count) {
  const picks = []
  for (let i = 0; picks.length < count; i++) {
    let added = false
    for (const section of sections) {
      if (picks.length >= count) break
      const track = section.tracks[i]
      if (track) {
        picks.push(track)
        added = true
      }
    }
    if (!added) break
  }
  return picks
}

// nightly Spotify-free "Discover Weekly" for every user: pull their top
// recommendations into the shared library and remember which files belong to
// their mix; the app turns that list into a playlist the user owns
async function runDiscover() {
  if (discoverRunning) return
  discoverRunning = true
  try {
    const config = loadConfig()
    if (config.discover === false) return
    for (const user of listUserIds(config)) {
      const data = await getRecommendations(config, true, user.id)
      const files = []
      for (const track of pickRoundRobin(data.sections, DISCOVER_COUNT)) {
        try {
          const key = trackKey(track.artist, track.title)
          if (!stagedFile(key)) await grabToStage(track.artist, track.title)
          const file = moveStaged(key, track.artist, config)
          if (file) files.push(path.relative(config.musicDir, file))
        } catch (error) {
          console.log("discover: skip " + track.artist + " - " + track.title + " (" + error.message + ")")
        }
      }
      if (files.length) {
        saveDiscoverMix(user.id, files)
        console.log("discover: " + files.length + " new tracks in the Discover Mix for " + user.username)
      }
    }
  } finally {
    discoverRunning = false
  }
}

function mixSongIds(config, files) {
  if (!config.navidromeDb || !fs.existsSync(config.navidromeDb) || !files.length) return []
  const canon = (p) => p.split(/[\\/]+/).join("/").toLowerCase()
  const wanted = new Map(files.map((f, i) => [canon(f), i]))
  const db = new DatabaseSync(config.navidromeDb, { readOnly: true })
  try {
    const found = []
    for (const row of db.prepare("select id, path from media_file").all()) {
      const rel = path.isAbsolute(row.path) ? path.relative(config.musicDir, row.path) : row.path
      const index = wanted.get(canon(rel))
      if (index !== undefined) found.push([index, row.id])
    }
    return found.sort((a, b) => a[0] - b[0]).map(([, id]) => id)
  } finally {
    db.close()
  }
}

function scheduleDaily(hour, run) {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  setTimeout(() => {
    run()
    setInterval(run, 24 * 60 * 60 * 1000).unref()
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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
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

function publicUser(u) {
  return { id: u.id, userName: u.userName, name: u.name, isAdmin: u.isAdmin, lastAccessAt: u.lastAccessAt }
}

async function handleAdmin(req, res, url, config, user) {
  const token = await adminToken(config, req)
  if (!token) {
    send(res, 403, { ok: false, error: "admin login required" })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/admin/users") {
    const users = await navidromeApi(config, token, "GET", "/user")
    send(res, 200, { ok: true, users: users.map(publicUser) })
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/admin/users") {
    const data = await readJson(req)
    const userName = String(data.userName || "").trim()
    const password = String(data.password || "")
    if (!/^[A-Za-z0-9._-]{2,32}$/.test(userName) || password.length < 4) {
      send(res, 400, { ok: false, error: "username (letters, numbers, . _ -) and a password of 4+ characters are required" })
      return
    }
    const created = await navidromeApi(config, token, "POST", "/user", {
      userName,
      name: String(data.name || userName).trim(),
      password,
      isAdmin: data.isAdmin === true
    })
    send(res, 200, { ok: true, id: created.id })
    return
  }

  const match = url.pathname.match(/^\/manage\/api\/admin\/users\/([A-Za-z0-9_-]+)$/)
  if (match && req.method === "PUT") {
    const data = await readJson(req)
    const password = String(data.password || "")
    if (password.length < 4) {
      send(res, 400, { ok: false, error: "password must be 4+ characters" })
      return
    }
    const current = await navidromeApi(config, token, "GET", "/user/" + match[1])
    await navidromeApi(config, token, "PUT", "/user/" + match[1], { ...current, password })
    forgetUser(current.userName)
    send(res, 200, { ok: true })
    return
  }

  if (match && req.method === "DELETE") {
    if (match[1] === user.id) {
      send(res, 400, { ok: false, error: "you cannot delete your own account" })
      return
    }
    const doomed = await navidromeApi(config, token, "GET", "/user/" + match[1])
    await navidromeApi(config, token, "DELETE", "/user/" + match[1])
    forgetUser(doomed.userName)
    send(res, 200, { ok: true })
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/admin/discover/run") {
    const wasRunning = discoverRunning
    runDiscover().catch((e) => console.log("discover: " + e.message))
    send(res, 200, { ok: true, started: !wasRunning })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/fixtags/pending") {
    const limit = Math.min(Number(url.searchParams.get("limit")) || 120, 500)
    send(res, 200, { ok: true, rows: findPending(config, limit) })
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/fixtags/apply") {
    const data = await readJson(req)
    const fixed = await applyAnswers(config, Array.isArray(data.answers) ? data.answers : [], data.attempted || [])
    send(res, 200, { ok: true, fixed })
    return
  }

  send(res, 404, { ok: false, error: "not found" })
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost")

  if (req.method === "GET" && url.pathname === "/manage/api/health") {
    send(res, 200, { ok: true })
    return
  }

  const config = loadConfig()
  const user = await verify(config, req)
  if (!user) {
    send(res, 401, { ok: false, error: "sign in required" })
    return
  }

  if (url.pathname.startsWith("/manage/api/admin/") || url.pathname.startsWith("/manage/api/fixtags/")) {
    if (!user.admin) {
      send(res, 403, { ok: false, error: "admin only" })
      return
    }
    await handleAdmin(req, res, url, config, user)
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/me") {
    send(res, 200, { ok: true, username: user.username, admin: user.admin })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/recommendations") {
    const data = await getRecommendations(config, url.searchParams.get("refresh") === "1", user.id)
    send(res, 200, { ok: true, sections: data.sections })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/discover/mix") {
    const mix = getDiscoverMix(user.id)
    if (!mix) {
      send(res, 200, { ok: true, generatedAt: 0, songIds: [] })
      return
    }
    send(res, 200, { ok: true, generatedAt: mix.generatedAt, songIds: mixSongIds(config, mix.files) })
    return
  }

  if (req.method === "POST" && (url.pathname === "/manage/api/pull" || url.pathname === "/manage/api/prefetch")) {
    const data = await readJson(req)
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
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/dismiss") {
    const data = await readJson(req)
    const artist = String(data.artist || "").trim()
    const title = String(data.title || "").trim()
    if (!artist) {
      send(res, 400, { ok: false, error: "missing artist" })
      return
    }
    addToBlacklist(user.id, norm(artist) + "|" + (title ? norm(title) : "*"))
    send(res, 200, { ok: true })
    return
  }

  if (req.method === "GET" && url.pathname === "/manage/api/search") {
    const query = (url.searchParams.get("q") || "").trim()
    if (!query) {
      send(res, 400, { ok: false, error: "missing q" })
      return
    }
    recordSearch(user.id, query)
    const results = await searchSongs(query, 10)
    // speculatively stage the top hit so tapping Get is instant
    if (results[0]) startYtPrefetch(results[0].id)
    send(res, 200, { ok: true, results })
    return
  }

  if (req.method === "POST" && url.pathname === "/manage/api/download") {
    const data = await readJson(req)
    const videoId = String(data.id || "")
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      send(res, 400, { ok: false, error: "invalid video id" })
      return
    }
    const quality = QUALITIES.includes(data.quality) ? data.quality : "320K"
    send(res, 200, { ok: true, jobId: startJob(videoId, quality) })
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
    if (!user.admin) {
      send(res, 403, { ok: false, error: "only the admin can delete songs" })
      return
    }
    const data = await readJson(req)
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
    // deleted = never wanted; keep it out of everyone's recommendations
    if (row && row.artist && row.title) addToGlobalBlacklist(norm(row.artist) + "|" + norm(row.title))
    const dir = path.dirname(target)
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
    } catch (e) {
      void e
    }
    send(res, 200, { ok: true })
    return
  }

  send(res, 404, { ok: false, error: "not found" })
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!res.headersSent) send(res, 500, { ok: false, error: error.message })
  })
})

function startup() {
  const config = loadConfig()
  const admin = listUserIds(config).find((u) => u.admin)
  if (admin) migrateLegacy(admin.id)
  // the old single-user mix was an .m3u in the music folder; mixes are now per user
  const legacyMix = path.join(config.musicDir, "Discover Mix.m3u")
  if (fs.existsSync(legacyMix)) fs.rmSync(legacyMix, { force: true })
}

startup()
pruneStage()
setInterval(pruneStage, 60 * 60 * 1000).unref()
scheduleDaily(BACKUP_HOUR, () => {
  try {
    runBackup()
  } catch (e) {
    console.log("backup: " + e.message)
  }
})
scheduleDaily(DISCOVER_HOUR, () => runDiscover().catch((e) => console.log("discover: " + e.message)))
// Claude Code usually lives on another machine (fixtags-remote.js); only run
// the local fixer when this host has it installed and logged in
if (loadConfig().fixTags === "local") {
  scheduleDaily(DISCOVER_HOUR + 1, () => runFixTags().catch((e) => console.log("fixtags: " + e.message)))
}

server.listen(PORT, () => {
  console.log("arashmusic management server on port " + PORT)
})
