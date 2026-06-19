const { spawn } = require("child_process")
const path = require("path")
const fs = require("fs")
const { fetchAndWriteLyrics } = require("./lyrics")

const ROOT = path.resolve(__dirname, "..")
const TOOLS = path.join(ROOT, "tools")
const YTDLP = path.join(TOOLS, "yt-dlp.exe")

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"))
}

function run(args, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args)
    let out = ""
    let err = ""
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString()
      out += text
      if (onProgress) onProgress(text)
    })
    child.stderr.on("data", (chunk) => {
      err += chunk.toString()
    })
    child.on("error", (e) => reject(e))
    child.on("close", (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err.trim() || "yt-dlp exited with code " + code))
    })
  })
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return ""
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return minutes + ":" + String(rest).padStart(2, "0")
}

async function searchSongs(query, count) {
  const n = count || 6
  const out = await run(["ytsearch" + n + ":" + query, "--flat-playlist", "--dump-json", "--no-warnings"])
  const results = []
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch (e) {
      void e
      continue
    }
    if (!entry.id) continue
    results.push({
      id: entry.id,
      title: entry.title || "Unknown title",
      uploader: entry.channel || entry.uploader || "",
      duration: formatDuration(entry.duration),
      url: entry.url || "https://www.youtube.com/watch?v=" + entry.id
    })
  }
  return results
}

function downloadInput(input, audioQuality, onProgress) {
  const config = loadConfig()
  const quality = audioQuality || "0"
  const template = path.join(config.musicDir, "%(artist,uploader)s", "%(title)s.%(ext)s")
  const args = [
    input,
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    quality,
    "--embed-thumbnail",
    "--embed-metadata",
    "--convert-thumbnails",
    "jpg",
    "--no-playlist",
    "--no-mtime",
    "--ffmpeg-location",
    TOOLS,
    "-o",
    template,
    "--print",
    "after_move:filepath"
  ]
  return run(args, onProgress).then(async (out) => {
    const lines = out.trim().split(/\r?\n/).filter(Boolean)
    const file = lines.length ? lines[lines.length - 1].trim() : ""
    if (file) {
      try {
        await fetchAndWriteLyrics(file)
      } catch (e) {
        void e
      }
    }
    return file
  })
}

function downloadSong(query, onProgress) {
  return downloadInput("ytsearch1:" + query, "0", onProgress)
}

function downloadById(videoId, audioQuality, onProgress) {
  return downloadInput("https://www.youtube.com/watch?v=" + videoId, audioQuality, onProgress)
}

module.exports = { loadConfig, searchSongs, downloadSong, downloadById, downloadInput }
