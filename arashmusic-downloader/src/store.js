const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")

const ROOT = path.join(__dirname, "..")
const DB_FILE = path.join(ROOT, "data", "app.db")
const LEGACY_FILE = path.join(ROOT, "state.json")
const MAX_SEARCHES = 25

let db = null

function open() {
  if (db) return db
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true })
  db = new DatabaseSync(DB_FILE)
  db.exec(`
    create table if not exists searches (user_id text not null, term text not null, at integer not null);
    create index if not exists searches_user on searches (user_id, at);
    create table if not exists blacklist (user_id text not null, key text not null, primary key (user_id, key));
    create table if not exists global_blacklist (key text primary key);
    create table if not exists fixtags_attempts (file_id text primary key, at integer not null);
    create table if not exists discover_mix (user_id text primary key, generated_at integer not null, files text not null);
  `)
  return db
}

function dbPath() {
  return DB_FILE
}

// one-time move of the single-user state.json into app.db, owned by the admin
function migrateLegacy(ownerId) {
  if (!ownerId || !fs.existsSync(LEGACY_FILE)) return
  let state = {}
  try {
    state = JSON.parse(fs.readFileSync(LEGACY_FILE, "utf8"))
  } catch (e) {
    void e
  }
  const conn = open()
  const insertSearch = conn.prepare("insert into searches (user_id, term, at) values (?, ?, ?)")
  const insertBlack = conn.prepare("insert or ignore into blacklist (user_id, key) values (?, ?)")
  const insertAttempt = conn.prepare("insert or ignore into fixtags_attempts (file_id, at) values (?, ?)")
  for (const s of state.searches || []) insertSearch.run(ownerId, s.term, s.at || Date.now())
  for (const key of state.blacklist || []) insertBlack.run(ownerId, key)
  for (const id of state.tagFixAttempts || []) insertAttempt.run(id, Date.now())
  fs.renameSync(LEGACY_FILE, LEGACY_FILE + ".migrated")
  console.log("store: migrated state.json into data/app.db")
}

function getBlacklist(userId) {
  const conn = open()
  const keys = conn.prepare("select key from global_blacklist").all().map((r) => r.key)
  if (userId) keys.push(...conn.prepare("select key from blacklist where user_id = ?").all(userId).map((r) => r.key))
  return new Set(keys)
}

function addToBlacklist(userId, key) {
  if (!userId || !key) return
  open().prepare("insert or ignore into blacklist (user_id, key) values (?, ?)").run(userId, key)
}

function addToGlobalBlacklist(key) {
  if (!key) return
  open().prepare("insert or ignore into global_blacklist (key) values (?)").run(key)
}

function getSearches(userId) {
  if (!userId) return []
  return open().prepare("select term, at from searches where user_id = ? order by at desc limit ?").all(userId, MAX_SEARCHES)
}

function recordSearch(userId, query) {
  const term = String(query || "").trim()
  if (!userId || term.length < 2) return
  const lower = term.toLowerCase()
  const conn = open()
  // debounced typing records prefixes ("newj", "newje"); keep only the longest
  for (const s of getSearches(userId)) {
    const other = s.term.toLowerCase()
    if (lower.startsWith(other) || other.startsWith(lower)) {
      conn.prepare("delete from searches where user_id = ? and term = ?").run(userId, s.term)
    }
  }
  conn.prepare("insert into searches (user_id, term, at) values (?, ?, ?)").run(userId, term, Date.now())
  conn
    .prepare(
      "delete from searches where user_id = ? and rowid not in (select rowid from searches where user_id = ? order by at desc limit ?)"
    )
    .run(userId, userId, MAX_SEARCHES)
}

function getTagFixAttempts() {
  return new Set(open().prepare("select file_id from fixtags_attempts").all().map((r) => r.file_id))
}

function markTagFixAttempts(ids) {
  const stmt = open().prepare("insert or ignore into fixtags_attempts (file_id, at) values (?, ?)")
  for (const id of ids) stmt.run(id, Date.now())
}

function saveDiscoverMix(userId, files) {
  open()
    .prepare("insert or replace into discover_mix (user_id, generated_at, files) values (?, ?, ?)")
    .run(userId, Date.now(), JSON.stringify(files))
}

function getDiscoverMix(userId) {
  const row = open().prepare("select generated_at, files from discover_mix where user_id = ?").get(userId)
  if (!row) return null
  return { generatedAt: row.generated_at, files: JSON.parse(row.files) }
}

module.exports = {
  dbPath,
  migrateLegacy,
  getBlacklist,
  addToBlacklist,
  addToGlobalBlacklist,
  getSearches,
  recordSearch,
  getTagFixAttempts,
  markTagFixAttempts,
  saveDiscoverMix,
  getDiscoverMix
}
