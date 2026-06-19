const http = require("http")
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
const { loadConfig } = require("./download")

const PORT = 4544

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
  if (req.method === "GET" && req.url === "/manage/api/health") {
    send(res, 200, { ok: true })
    return
  }

  if (req.method === "POST" && req.url === "/manage/api/delete") {
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

server.listen(PORT, () => {
  console.log("arashmusic management server on port " + PORT)
})
