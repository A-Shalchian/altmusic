const fs = require("fs")
const path = require("path")

const FILE = path.join(__dirname, "..", "state.json")
const MAX_SEARCHES = 25

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"))
  } catch (e) {
    void e
    return {}
  }
}

function save(state) {
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2))
}

function getBlacklist() {
  return new Set(load().blacklist || [])
}

function addToBlacklist(key) {
  if (!key) return
  const state = load()
  const list = new Set(state.blacklist || [])
  list.add(key)
  state.blacklist = [...list]
  save(state)
}

function getSearches() {
  return load().searches || []
}

function recordSearch(query) {
  const term = String(query || "").trim()
  if (term.length < 2) return
  const lower = term.toLowerCase()
  const state = load()
  // debounced typing records prefixes ("newj", "newje"); keep only the longest
  const searches = (state.searches || []).filter(
    (s) => !lower.startsWith(s.term.toLowerCase()) && !s.term.toLowerCase().startsWith(lower)
  )
  searches.unshift({ term, at: Date.now() })
  state.searches = searches.slice(0, MAX_SEARCHES)
  save(state)
}

function getTagFixAttempts() {
  return new Set(load().tagFixAttempts || [])
}

function markTagFixAttempts(ids) {
  const state = load()
  const list = new Set(state.tagFixAttempts || [])
  for (const id of ids) list.add(id)
  state.tagFixAttempts = [...list].slice(-5000)
  save(state)
}

module.exports = { getBlacklist, addToBlacklist, getSearches, recordSearch, getTagFixAttempts, markTagFixAttempts }
