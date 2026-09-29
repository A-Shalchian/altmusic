const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
const { loadConfig } = require("./download")
const { getTagFixAttempts, markTagFixAttempts } = require("./store")

const TOOLS = path.join(__dirname, "..", "tools")
const FFMPEG = path.join(TOOLS, "ffmpeg.exe")
const BATCH = 40
const MAX_BATCHES = 3

const JUNK_ARTISTS = new Set(["", "unknown", "unknown artist", "[unknown artist]", "various artists", "na"])

function junkArtist(value) {
  const v = String(value || "").trim().toLowerCase()
  return JUNK_ARTISTS.has(v) || v.endsWith(" - topic") || v.endsWith("vevo") || v.endsWith(" official")
}

function junkAlbum(value) {
  const v = String(value || "").trim().toLowerCase()
  return v === "" || v === "unknown album" || v === "[unknown album]" || v === "unknown"
}

function findBroken(config) {
  if (!config.navidromeDb || !fs.existsSync(config.navidromeDb)) return []
  const db = new DatabaseSync(config.navidromeDb, { readOnly: true })
  try {
    const rows = db.prepare("select id, path, title, artist, album from media_file").all()
    for (const row of rows) {
      // navidrome stores paths relative to the music folder
      if (!path.isAbsolute(row.path)) row.path = path.resolve(config.musicDir, row.path)
    }
    return rows.filter((r) => junkArtist(r.artist) || junkAlbum(r.album))
  } finally {
    db.close()
  }
}

// headless Claude Code (`claude -p`) — runs on the logged-in Claude
// subscription; this must never be switched to the Anthropic API
function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "json"], { shell: true })
    let out = ""
    let err = ""
    child.stdout.on("data", (c) => (out += c.toString()))
    child.stderr.on("data", (c) => (err += c.toString()))
    child.on("error", (e) => reject(e))
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || "claude exited with code " + code))
        return
      }
      try {
        const envelope = JSON.parse(out)
        resolve(String(envelope.result || ""))
      } catch (e) {
        void e
        resolve(out)
      }
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf("[")
  const end = raw.lastIndexOf("]")
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON array in response")
  return JSON.parse(raw.slice(start, end + 1))
}

function findPending(config, limit) {
  const attempted = getTagFixAttempts()
  return findBroken(config)
    .filter((r) => !attempted.has(r.id) && fs.existsSync(r.path))
    .slice(0, limit)
    .map((r) => ({ id: r.id, file: r.path.split(/[\\/]/).slice(-3).join("/"), title: r.title, artist: r.artist, album: r.album }))
}

function buildPrompt(rows) {
  const lines = rows.map((r) =>
    JSON.stringify({ id: r.id, file: r.file, title: r.title, artist: r.artist, album: r.album })
  )
  return [
    "You fix music metadata. Each line below is one song with its file path and current (possibly wrong or missing) tags.",
    "Using the file path, title and your music knowledge, return the correct primary artist name, clean song title (no 'Official Video', '(Lyrics)', 'M/V' noise), and album name (single/EP/album the song belongs to).",
    "Rules:",
    "- Reply with ONLY a JSON array, no prose, no code fences.",
    "- One object per input line: {\"id\": \"...\", \"artist\": \"...\", \"title\": \"...\", \"album\": \"...\"}.",
    "- Use the exact id from the input.",
    "- If you are not confident about a field, set it to null. Never guess an album you are unsure of.",
    "- Artist names in their official latin spelling (e.g. NewJeans, IU, BLACKPINK).",
    "",
    "Songs:",
    ...lines
  ].join("\n")
}

function retag(file, tags) {
  return new Promise((resolve, reject) => {
    const tmp = file.replace(/\.mp3$/i, "") + ".fixtags.mp3"
    const args = ["-y", "-i", file, "-map", "0", "-c", "copy", "-id3v2_version", "3"]
    for (const [key, value] of Object.entries(tags)) {
      if (value) args.push("-metadata", key + "=" + value)
    }
    args.push(tmp)
    const child = spawn(FFMPEG, args)
    let err = ""
    child.stderr.on("data", (c) => (err += c.toString()))
    child.on("error", (e) => reject(e))
    child.on("close", (code) => {
      if (code !== 0) {
        fs.rmSync(tmp, { force: true })
        reject(new Error(err.trim().split(/\r?\n/).pop() || "ffmpeg exited with code " + code))
        return
      }
      fs.renameSync(tmp, file)
      resolve()
    })
  })
}

const differs = (a, b) => String(a).trim().toLowerCase() !== String(b || "").trim().toLowerCase()

// answers come from Claude, run either here or on another machine through
// the fixtags endpoints; ids that are no longer broken are ignored
async function applyAnswers(config, answers, attemptedIds) {
  const byId = new Map(findBroken(config).map((r) => [r.id, r]))
  let fixed = 0
  for (const answer of answers || []) {
    const row = byId.get(answer && answer.id)
    if (!row || !fs.existsSync(row.path)) continue
    const tags = {}
    if (answer.artist && differs(answer.artist, row.artist)) {
      tags.artist = String(answer.artist)
      tags.album_artist = String(answer.artist)
    }
    if (answer.title && differs(answer.title, row.title)) tags.title = String(answer.title)
    if (answer.album && differs(answer.album, row.album)) tags.album = String(answer.album)
    if (!Object.keys(tags).length) continue
    try {
      await retag(row.path, tags)
      fixed++
      console.log("fixtags: " + path.basename(row.path) + " -> " + JSON.stringify(tags))
    } catch (error) {
      console.log("fixtags: retag failed for " + row.path + " (" + error.message + ")")
    }
  }
  markTagFixAttempts((attemptedIds || []).filter((id) => byId.has(id)))
  return fixed
}

async function runFixTags() {
  const config = loadConfig()
  const pending = findPending(config, BATCH * MAX_BATCHES)
  if (!pending.length) {
    console.log("fixtags: nothing to fix")
    return { fixed: 0, scanned: 0 }
  }

  let fixed = 0
  let scanned = 0
  for (let i = 0; i * BATCH < pending.length; i++) {
    const batch = pending.slice(i * BATCH, (i + 1) * BATCH)
    let answers
    try {
      answers = extractJson(await askClaude(buildPrompt(batch)))
    } catch (error) {
      console.log("fixtags: claude failed (" + error.message + ")")
      break
    }
    scanned += batch.length
    fixed += await applyAnswers(config, answers, batch.map((r) => r.id))
  }

  console.log("fixtags: fixed " + fixed + " of " + scanned + " scanned")
  return { fixed, scanned }
}

if (require.main === module) {
  runFixTags().catch((error) => {
    console.error("fixtags: " + error.message)
    process.exit(1)
  })
}

module.exports = { runFixTags, findPending, applyAnswers, buildPrompt, askClaude, extractJson, BATCH, MAX_BATCHES }
