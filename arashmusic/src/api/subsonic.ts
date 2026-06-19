import { md5 } from "js-md5"
import { useAuthStore } from "../store/authStore"
import type { Album, Artist, Playlist, SearchResult, Song, StructuredLyrics } from "./types"

const CLIENT = "arashmusic"
const API_VERSION = "1.16.1"

function randomSalt(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

interface Credentials {
  serverUrl: string
  username: string
  password: string
}

let tokenCache: { username: string; password: string; salt: string; token: string } | null = null

function authFor(creds: Credentials): { salt: string; token: string } {
  if (!tokenCache || tokenCache.username !== creds.username || tokenCache.password !== creds.password) {
    const salt = randomSalt()
    tokenCache = { username: creds.username, password: creds.password, salt, token: md5(creds.password + salt) }
  }
  return { salt: tokenCache.salt, token: tokenCache.token }
}

function authParams(creds: Credentials): URLSearchParams {
  const { salt, token } = authFor(creds)
  return new URLSearchParams({
    u: creds.username,
    t: token,
    s: salt,
    v: API_VERSION,
    c: CLIENT,
    f: "json"
  })
}

function base(serverUrl: string): string {
  const trimmed = serverUrl.replace(/\/+$/, "")
  return trimmed + "/rest"
}

export function buildUrl(endpoint: string, params: Record<string, string | number | undefined>): string {
  const creds = currentCredentials()
  const search = authParams(creds)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  return base(creds.serverUrl) + "/" + endpoint + ".view?" + search.toString()
}

function currentCredentials(): Credentials {
  const state = useAuthStore.getState()
  return {
    serverUrl: state.serverUrl,
    username: state.username,
    password: state.password
  }
}

async function request<T>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = buildUrl(endpoint, params)
  const res = await fetch(url)
  if (!res.ok) throw new Error("Network error " + res.status)
  const body = await res.json()
  const response = body["subsonic-response"]
  if (!response) throw new Error("Invalid server response")
  if (response.status === "failed") {
    const message = response.error?.message || "Request failed"
    throw new Error(message)
  }
  return response as T
}

export async function ping(creds: Credentials): Promise<boolean> {
  const search = authParams(creds)
  const url = base(creds.serverUrl) + "/ping.view?" + search.toString()
  const res = await fetch(url)
  if (!res.ok) return false
  const body = await res.json()
  return body["subsonic-response"]?.status === "ok"
}

export function coverArtUrl(coverArt: string | undefined, size = 300): string {
  if (!coverArt) return ""
  return buildUrl("getCoverArt", { id: coverArt, size })
}

export function streamUrl(id: string): string {
  return buildUrl("stream", { id })
}

export async function getAlbumList(type: string, size = 24, offset = 0): Promise<Album[]> {
  const res = await request<{ albumList2?: { album?: Album[] } }>("getAlbumList2", { type, size, offset })
  return res.albumList2?.album ?? []
}

export async function getAlbum(id: string): Promise<Album> {
  const res = await request<{ album: Album }>("getAlbum", { id })
  return res.album
}

export async function getArtists(): Promise<Artist[]> {
  const res = await request<{ artists?: { index?: { artist?: Artist[] }[] } }>("getArtists")
  const index = res.artists?.index ?? []
  return index.flatMap((entry) => entry.artist ?? [])
}

export async function getArtist(id: string): Promise<Artist> {
  const res = await request<{ artist: Artist }>("getArtist", { id })
  return res.artist
}

export async function getPlaylists(): Promise<Playlist[]> {
  const res = await request<{ playlists?: { playlist?: Playlist[] } }>("getPlaylists")
  return res.playlists?.playlist ?? []
}

export async function getPlaylist(id: string): Promise<Playlist> {
  const res = await request<{ playlist: Playlist }>("getPlaylist", { id })
  return res.playlist
}

export async function getStarred(): Promise<Song[]> {
  const res = await request<{ starred2?: { song?: Song[] } }>("getStarred2")
  return res.starred2?.song ?? []
}

export async function getRandomSongs(size = 50): Promise<Song[]> {
  const res = await request<{ randomSongs?: { song?: Song[] } }>("getRandomSongs", { size })
  return res.randomSongs?.song ?? []
}

export async function getAllSongs(offset: number, size: number): Promise<Song[]> {
  const res = await request<{ searchResult3?: { song?: Song[] } }>("search3", {
    query: "",
    artistCount: 0,
    albumCount: 0,
    songCount: size,
    songOffset: offset
  })
  return res.searchResult3?.song ?? []
}

export async function getEntireLibrary(): Promise<Song[]> {
  const all: Song[] = []
  const page = 500
  for (let offset = 0; offset < 20000; offset += page) {
    const batch = await getAllSongs(offset, page)
    all.push(...batch)
    if (batch.length < page) break
  }
  return all
}

export async function createPlaylist(name: string): Promise<string> {
  const res = await request<{ playlist?: { id: string } }>("createPlaylist", { name })
  return res.playlist?.id ?? ""
}

export async function addToPlaylist(playlistId: string, songId: string): Promise<void> {
  await request("updatePlaylist", { playlistId, songIdToAdd: songId })
}

export async function removeFromPlaylist(playlistId: string, index: number): Promise<void> {
  await request("updatePlaylist", { playlistId, songIndexToRemove: index })
}

export async function renamePlaylist(playlistId: string, name: string): Promise<void> {
  await request("updatePlaylist", { playlistId, name })
}

export async function deletePlaylist(id: string): Promise<void> {
  await request("deletePlaylist", { id })
}

export async function search(query: string): Promise<SearchResult> {
  const res = await request<{ searchResult3?: Partial<SearchResult> }>("search3", {
    query,
    songCount: 30,
    albumCount: 20,
    artistCount: 20
  })
  const r = res.searchResult3 ?? {}
  return {
    artist: r.artist ?? [],
    album: r.album ?? [],
    song: r.song ?? []
  }
}

export async function getSimilarSongs(id: string, count = 50): Promise<Song[]> {
  const res = await request<{ similarSongs2?: { song?: Song[] } }>("getSimilarSongs2", { id, count })
  return res.similarSongs2?.song ?? []
}

export async function getLyrics(id: string): Promise<StructuredLyrics[]> {
  const res = await request<{ lyricsList?: { structuredLyrics?: StructuredLyrics[] } }>(
    "getLyricsBySongId",
    { id }
  )
  return res.lyricsList?.structuredLyrics ?? []
}

export async function star(id: string): Promise<void> {
  await request("star", { id })
}

export async function unstar(id: string): Promise<void> {
  await request("unstar", { id })
}

export async function scrobble(id: string, submission = true): Promise<void> {
  await request("scrobble", { id, submission: submission ? "true" : "false" })
}

export async function deleteSong(song: { id: string; path?: string }): Promise<void> {
  const res = await fetch("/manage/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: song.id, path: song.path })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || "Delete failed")
}
