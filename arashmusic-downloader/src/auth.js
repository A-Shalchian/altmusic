const crypto = require("crypto")
const fs = require("fs")
const { DatabaseSync } = require("node:sqlite")

const CACHE_TTL = 5 * 60 * 1000
const cache = new Map()
const adminCache = new Map()

function navidromeUrl(config) {
  return (config.navidromeUrl || "http://127.0.0.1:4533").replace(/\/+$/, "")
}

function userIdFor(config, username) {
  if (!config.navidromeDb || !fs.existsSync(config.navidromeDb)) return null
  const db = new DatabaseSync(config.navidromeDb, { readOnly: true })
  try {
    const row = db.prepare("select id from user where user_name = ? collate nocase").get(username)
    return row ? row.id : null
  } finally {
    db.close()
  }
}

function listUserIds(config) {
  if (!config.navidromeDb || !fs.existsSync(config.navidromeDb)) return []
  const db = new DatabaseSync(config.navidromeDb, { readOnly: true })
  try {
    return db.prepare("select id, user_name as username, is_admin as admin from user").all()
  } finally {
    db.close()
  }
}

// the app sends the same salted token it uses for Subsonic calls, so the
// password never travels for normal requests; Navidrome is the only judge
async function verify(config, req) {
  const username = String(req.headers["x-am-user"] || "")
  const token = String(req.headers["x-am-token"] || "")
  const salt = String(req.headers["x-am-salt"] || "")
  if (!username || !token || !salt) return null

  const cacheKey = username + "|" + token + "|" + salt
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.user

  const params = new URLSearchParams({ u: username, t: token, s: salt, v: "1.16.1", c: "arashmusic-server", f: "json", username })
  let body
  try {
    const res = await fetch(navidromeUrl(config) + "/rest/getUser.view?" + params.toString())
    body = await res.json()
  } catch (e) {
    void e
    return null
  }
  const response = body && body["subsonic-response"]
  if (!response || response.status !== "ok" || !response.user) return null

  const id = userIdFor(config, username)
  if (!id) return null
  const user = { id, username: response.user.username, admin: response.user.adminRole === true }
  cache.set(cacheKey, { at: Date.now(), user })
  return user
}

// admin actions go through Navidrome's own REST API, which only accepts a
// password login, so admin requests carry the password in a header. Navidrome
// rate-limits /auth/login, so the token (valid 48h) is reused for an hour
async function adminToken(config, req) {
  const username = String(req.headers["x-am-user"] || "")
  const password = String(req.headers["x-am-password"] || "")
  if (!username || !password) return null
  const cacheKey = crypto.createHash("sha256").update(username + ":" + password).digest("hex")
  const hit = adminCache.get(cacheKey)
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.token
  try {
    const res = await fetch(navidromeUrl(config) + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.isAdmin) return null
    adminCache.set(cacheKey, { at: Date.now(), token: data.token })
    return data.token
  } catch (e) {
    void e
    return null
  }
}

function forgetUser(username) {
  const prefix = String(username).toLowerCase() + "|"
  for (const key of cache.keys()) {
    if (key.toLowerCase().startsWith(prefix)) cache.delete(key)
  }
  adminCache.clear()
}

const FRIENDLY_ERRORS = { "ra.validation.unique": "that username is already taken" }

async function navidromeApi(config, token, method, path, body) {
  const res = await fetch(navidromeUrl(config) + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", "x-nd-authorization": "Bearer " + token },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (e) {
    void e
  }
  if (!res.ok) {
    let message = (data && (data.error || data.message || data.errors)) || text || "navidrome responded " + res.status
    if (typeof message !== "string") message = Object.values(message).map((m) => FRIENDLY_ERRORS[m] || m).join(", ")
    throw new Error(message)
  }
  return data
}

module.exports = { verify, adminToken, navidromeApi, listUserIds, forgetUser }
