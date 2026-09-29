const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
const { loadConfig } = require("./download")
const { dbPath } = require("./store")

const ROOT = path.join(__dirname, "..")
const KEEP_DAYS = 14

// VACUUM INTO gives a consistent copy even while Navidrome is writing
function snapshot(source, target) {
  if (!source || !fs.existsSync(source)) return false
  const db = new DatabaseSync(source, { readOnly: true })
  try {
    db.exec("vacuum into '" + target.replace(/'/g, "''") + "'")
    return true
  } finally {
    db.close()
  }
}

function runBackup() {
  const config = loadConfig()
  const base = config.backupDir || path.join(ROOT, "backups")
  const stamp = new Date().toLocaleDateString("sv-SE")
  const dir = path.join(base, stamp)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })

  snapshot(config.navidromeDb, path.join(dir, "navidrome.db"))
  snapshot(dbPath(), path.join(dir, "app.db"))
  fs.copyFileSync(path.join(ROOT, "config.json"), path.join(dir, "config.json"))

  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000
  for (const entry of fs.readdirSync(base)) {
    const full = path.join(base, entry)
    if (/^\d{4}-\d{2}-\d{2}$/.test(entry) && fs.statSync(full).mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true })
    }
  }
  console.log("backup: wrote " + dir)
  return dir
}

if (require.main === module) {
  try {
    runBackup()
  } catch (error) {
    console.error("backup: " + error.message)
    process.exit(1)
  }
}

module.exports = { runBackup }
