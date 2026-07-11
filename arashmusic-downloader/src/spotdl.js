const { spawn } = require("child_process")
const path = require("path")
const { loadConfig } = require("./download")

const ROOT = path.resolve(__dirname, "..")
const TOOLS = path.join(ROOT, "tools")
const SPOTDL = path.join(TOOLS, "spotdl.exe")
const FFMPEG = path.join(TOOLS, "ffmpeg.exe")

function isSpotifyUrl(text) {
  return /open\.spotify\.com\/(track|album|playlist|artist)\//i.test(text)
}

function runSpotdl(input, template, threads, onProgress) {
  return new Promise((resolve, reject) => {
    const config = loadConfig()
    const args = [
      "download",
      input,
      "--output",
      template,
      "--format",
      "mp3",
      "--bitrate",
      "320k",
      "--ffmpeg",
      FFMPEG,
      "--generate-lrc",
      "--threads",
      String(threads)
    ]
    if (config.spotifyClientId && config.spotifyClientSecret) {
      args.push("--client-id", config.spotifyClientId, "--client-secret", config.spotifyClientSecret)
    }

    const child = spawn(SPOTDL, args)
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
      if (code === 0) {
        const downloaded = (out.match(/Downloaded "/g) || []).length
        resolve({ downloaded })
      } else {
        const tail = out.trim().split(/\r?\n/).slice(-3).join(" ")
        reject(new Error(err.trim() || tail || "spotdl exited with code " + code))
      }
    })
  })
}

function batchDownload(input, onProgress) {
  const config = loadConfig()
  const template = path.join(config.musicDir, "{artist}", "{album}", "{track-number} - {title}.{output-ext}")
  return runSpotdl(input, template, 2, onProgress)
}

// single track by "artist - title" search, downloaded into an explicit directory
// with a flat searchable filename; rejects when Spotify has no match so the
// caller can fall back to yt-dlp
async function downloadTrack(artist, title, outputDir) {
  const template = path.join(outputDir, "{artist} - {title}.{output-ext}")
  const result = await runSpotdl(artist + " - " + title, template, 1)
  if (!result.downloaded) throw new Error("spotdl found no match for " + artist + " - " + title)
  return result
}

module.exports = { batchDownload, downloadTrack, isSpotifyUrl }
