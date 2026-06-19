const fs = require("fs")
const path = require("path")
const { loadConfig } = require("./download")
const { fetchAndWriteLyrics, hasLyrics } = require("./lyrics")

const AUDIO = /\.(mp3|flac|m4a|ogg|opus|wav)$/i

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    let stat
    try {
      stat = fs.statSync(full)
    } catch (e) {
      void e
      continue
    }
    if (stat.isDirectory()) walk(full, out)
    else if (AUDIO.test(name)) out.push(full)
  }
  return out
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const config = loadConfig()
  const files = walk(config.musicDir, [])
  let synced = 0
  let plain = 0
  let none = 0
  let skipped = 0
  for (const file of files) {
    if (hasLyrics(file)) {
      skipped++
      continue
    }
    const result = await fetchAndWriteLyrics(file)
    if (result === "synced") synced++
    else if (result === "plain") plain++
    else none++
    console.log(result.padEnd(8) + path.basename(file))
    await delay(250)
  }
  console.log("synced: " + synced + "  plain: " + plain + "  none: " + none + "  skipped: " + skipped)
}

main()
