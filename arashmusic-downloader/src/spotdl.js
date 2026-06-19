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

function batchDownload(input, onProgress) {
  return new Promise((resolve, reject) => {
    const config = loadConfig()
    const template = path.join(config.musicDir, "{artist}", "{album}", "{track-number} - {title}.{output-ext}")
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
      "2"
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

module.exports = { batchDownload, isSpotifyUrl }
