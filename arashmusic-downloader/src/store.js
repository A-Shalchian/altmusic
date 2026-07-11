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
  const state = load()
  const searches = (state.searches || []).filter((s) => s.term.toLowerCase() !== term.toLowerCase())
  searches.unshift({ term, at: Date.now() })
  state.searches = searches.slice(0, MAX_SEARCHES)
  save(state)
}

module.exports = { getBlacklist, addToBlacklist, getSearches, recordSearch }
