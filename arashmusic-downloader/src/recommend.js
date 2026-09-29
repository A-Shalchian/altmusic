const fs = require("fs")
const { DatabaseSync } = require("node:sqlite")
const { getBlacklist, getSearches } = require("./store")

const CACHE_TTL = 10 * 60 * 1000
const SEED_LIMIT = 4
const RELATED_PER_SEED = 3
const TRACKS_PER_SECTION = 12

const cache = new Map()

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function trackKey(artist, title) {
  return norm(artist + " " + title).replace(/\s+/g, "-").slice(0, 80) || "unknown"
}

function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  return fetch(url, { signal: controller.signal, headers: { "User-Agent": "arashmusic/0.1.0" } })
    .then((res) => {
      if (!res.ok) throw new Error("deezer responded " + res.status)
      return res.json()
    })
    .finally(() => clearTimeout(timer))
}

function readLibrary(dbPath, userId) {
  if (!dbPath || !fs.existsSync(dbPath)) return { seeds: [], have: new Set(), haveTitles: new Set() }
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const rows = db.prepare("select artist, title from media_file").all()
    const have = new Set(rows.map((r) => norm(r.artist) + "|" + norm(r.title)))
    // yt titles often bundle the artist ("JENNIE - like JENNIE"), so index bare titles too
    const haveTitles = new Set(rows.map((r) => norm(r.title)))

    let seeds = []
    try {
      seeds = db
        .prepare(
          "select mf.artist as artist, sum(coalesce(a.play_count, 0)) + 5 * sum(case when a.starred then 1 else 0 end) as score " +
            "from annotation a join media_file mf on mf.id = a.item_id " +
            "where a.item_type = 'media_file' and a.user_id = ? " +
            "group by mf.artist order by score desc limit 8"
        )
        .all(userId)
        .map((r) => r.artist)
        .filter(Boolean)
    } catch (e) {
      void e
    }

    if (!seeds.length) {
      const counts = new Map()
      for (const row of rows) {
        if (row.artist) counts.set(row.artist, (counts.get(row.artist) || 0) + 1)
      }
      seeds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([artist]) => artist)
        .slice(0, 8)
    }

    return { seeds, have, haveTitles }
  } finally {
    db.close()
  }
}

function nameMatches(seed, candidate) {
  const a = norm(seed)
  const b = norm(candidate)
  return a === b || a.includes(b) || b.includes(a)
}

// resolve a free-text search term to a Deezer artist: exact artist hit first,
// then the artist of the top matching track (covers song-title searches)
async function artistFromQuery(term) {
  try {
    const found = await fetchJson("https://api.deezer.com/search/artist?q=" + encodeURIComponent(term))
    const artist = found.data && found.data[0]
    if (artist && nameMatches(term, artist.name) && (artist.nb_fan || 0) >= 2000) return artist.name
  } catch (e) {
    void e
  }
  try {
    const tracks = await fetchJson("https://api.deezer.com/search/track?q=" + encodeURIComponent(term))
    const track = tracks.data && tracks.data[0]
    if (track && track.artist && track.artist.name) return track.artist.name
  } catch (e) {
    void e
  }
  return null
}

async function sectionForSeed(seed, have, haveTitles, seen, blacklist, title) {
  const found = await fetchJson("https://api.deezer.com/search/artist?q=" + encodeURIComponent(seed))
  const artist = found.data && found.data[0]
  if (!artist) return null
  // junk seeds (uploader channels like "Rubik Music") either miss on Deezer
  // or fuzzy-match an unrelated artist — require a name match and a real fanbase
  if (!nameMatches(seed, artist.name) || (artist.nb_fan || 0) < 2000) return null

  const related = await fetchJson("https://api.deezer.com/artist/" + artist.id + "/related")
  const pool = [artist, ...(related.data || []).slice(0, RELATED_PER_SEED)]

  const tracks = []
  for (const a of pool) {
    let top
    try {
      top = await fetchJson("https://api.deezer.com/artist/" + a.id + "/top?limit=6")
    } catch (e) {
      void e
      continue
    }
    for (const t of top.data || []) {
      const name = (t.artist && t.artist.name) || a.name
      const k = norm(name) + "|" + norm(t.title)
      if (have.has(k) || seen.has(k) || blacklist.has(k) || blacklist.has(norm(name) + "|*")) continue
      if (haveTitles.has(norm(name + " " + t.title))) continue
      seen.add(k)
      tracks.push({
        key: trackKey(name, t.title),
        title: t.title,
        artist: name,
        cover: (t.album && t.album.cover_medium) || "",
        duration: t.duration || 0
      })
    }
  }

  if (!tracks.length) return null
  return { title: title || "Because you listen to " + seed, tracks: tracks.slice(0, TRACKS_PER_SECTION) }
}

async function getRecommendations(config, refresh, userId) {
  const cached = cache.get(userId)
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL) return cached.data

  const { seeds, have, haveTitles } = readLibrary(config.navidromeDb, userId)
  const blacklist = getBlacklist(userId)
  const sections = []
  const seen = new Set()
  const usedArtists = new Set()

  // recent searches are the strongest taste signal — lead with them
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const recentSearches = getSearches(userId).filter((s) => s.at >= cutoff).slice(0, 3)
  for (const search of recentSearches) {
    if (sections.length >= 2) break
    try {
      const artist = await artistFromQuery(search.term)
      if (!artist || usedArtists.has(norm(artist))) continue
      usedArtists.add(norm(artist))
      const section = await sectionForSeed(
        artist, have, haveTitles, seen, blacklist,
        'Because you searched for "' + search.term + '"'
      )
      if (section) sections.push(section)
    } catch (e) {
      void e
    }
  }

  for (const seed of seeds) {
    if (sections.length >= SEED_LIMIT + 2) break
    if (usedArtists.has(norm(seed))) continue
    usedArtists.add(norm(seed))
    try {
      const section = await sectionForSeed(seed, have, haveTitles, seen, blacklist)
      if (section) sections.push(section)
    } catch (e) {
      void e
    }
  }

  const data = { sections }
  if (sections.length) cache.set(userId, { at: Date.now(), data })
  return data
}

module.exports = { getRecommendations, trackKey, norm }
