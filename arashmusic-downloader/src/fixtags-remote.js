const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const { buildPrompt, askClaude, extractJson, BATCH, MAX_BATCHES } = require("./fixtags")

const REMOTE_FILE = path.join(__dirname, "..", "remote.json")

function loadRemote() {
  if (!fs.existsSync(REMOTE_FILE)) {
    throw new Error("missing remote.json (copy remote.example.json and fill in the host address and your admin login)")
  }
  const remote = JSON.parse(fs.readFileSync(REMOTE_FILE, "utf8"))
  if (!remote.host || !remote.username || !remote.password) throw new Error("remote.json needs host, username and password")
  return remote
}

function headers(remote) {
  const salt = crypto.randomBytes(8).toString("hex")
  return {
    "Content-Type": "application/json",
    "x-am-user": remote.username,
    "x-am-salt": salt,
    "x-am-token": crypto.createHash("md5").update(remote.password + salt).digest("hex"),
    "x-am-password": remote.password
  }
}

async function call(remote, method, route, body) {
  const res = await fetch(remote.host.replace(/\/+$/, "") + "/manage/api/fixtags/" + route, {
    method,
    headers: headers(remote),
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || "host responded " + res.status)
  return data
}

// runs on the machine that has Claude Code; the host only lists and retags
async function main() {
  const remote = loadRemote()
  const { rows } = await call(remote, "GET", "pending?limit=" + BATCH * MAX_BATCHES)
  if (!rows.length) {
    console.log("fixtags: nothing to fix")
    return
  }

  let fixed = 0
  for (let i = 0; i * BATCH < rows.length; i++) {
    const batch = rows.slice(i * BATCH, (i + 1) * BATCH)
    const answers = extractJson(await askClaude(buildPrompt(batch)))
    const result = await call(remote, "POST", "apply", { answers, attempted: batch.map((r) => r.id) })
    fixed += result.fixed
  }
  console.log("fixtags: fixed " + fixed + " of " + rows.length + " on " + remote.host)
}

main().catch((error) => {
  console.error("fixtags: " + error.message)
  process.exit(1)
})
