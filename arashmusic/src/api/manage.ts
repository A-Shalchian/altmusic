import { manageHeaders } from "./subsonic"

export interface WebResult {
  id: string
  title: string
  uploader: string
  duration: string
  url: string
}

export interface DownloadJob {
  status: "downloading" | "done" | "error"
  file: string | null
  error: string | null
}

async function manageRequest<T>(path: string, init?: RequestInit, admin = false): Promise<T> {
  const res = await fetch(path, { ...init, headers: manageHeaders(admin) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || "Request failed (" + res.status + ")")
  return data as T
}

export async function webSearch(query: string): Promise<WebResult[]> {
  const data = await manageRequest<{ results: WebResult[] }>(
    "/manage/api/search?q=" + encodeURIComponent(query)
  )
  return data.results
}

export async function startWebDownload(id: string, quality = "320K"): Promise<string> {
  const data = await manageRequest<{ jobId: string }>("/manage/api/download", {
    method: "POST",
    body: JSON.stringify({ id, quality })
  })
  return data.jobId
}

export async function getJob(jobId: string): Promise<DownloadJob> {
  return manageRequest<DownloadJob>("/manage/api/job?id=" + encodeURIComponent(jobId))
}

export async function waitForJob(jobId: string): Promise<DownloadJob> {
  for (;;) {
    const job = await getJob(jobId)
    if (job.status !== "downloading") return job
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

export interface RecTrack {
  key: string
  title: string
  artist: string
  cover: string
  duration: number
}

export interface RecSection {
  title: string
  tracks: RecTrack[]
}

export async function getRecommendations(refresh = false): Promise<RecSection[]> {
  const data = await manageRequest<{ sections: RecSection[] }>(
    "/manage/api/recommendations" + (refresh ? "?refresh=1" : "")
  )
  return data.sections
}

export async function prefetchTrack(artist: string, title: string): Promise<void> {
  await manageRequest("/manage/api/prefetch", {
    method: "POST",
    body: JSON.stringify({ artist, title })
  }).catch(() => undefined)
}

export async function dismissTrack(artist: string, title?: string): Promise<void> {
  await manageRequest("/manage/api/dismiss", {
    method: "POST",
    body: JSON.stringify({ artist, title })
  }).catch(() => undefined)
}

export async function pullTrack(artist: string, title: string): Promise<string> {
  const data = await manageRequest<{ jobId: string }>("/manage/api/pull", {
    method: "POST",
    body: JSON.stringify({ artist, title })
  })
  return data.jobId
}

export interface Me {
  username: string
  admin: boolean
}

export async function getMe(): Promise<Me> {
  return manageRequest<Me>("/manage/api/me")
}

export async function getDiscoverMix(): Promise<{ generatedAt: number; songIds: string[] }> {
  return manageRequest("/manage/api/discover/mix")
}

export interface ManagedUser {
  id: string
  userName: string
  name: string
  isAdmin: boolean
  lastAccessAt: string | null
}

export async function listUsers(): Promise<ManagedUser[]> {
  const data = await manageRequest<{ users: ManagedUser[] }>("/manage/api/admin/users", undefined, true)
  return data.users
}

export async function createUser(userName: string, name: string, password: string, isAdmin: boolean): Promise<void> {
  await manageRequest(
    "/manage/api/admin/users",
    { method: "POST", body: JSON.stringify({ userName, name, password, isAdmin }) },
    true
  )
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  await manageRequest(
    "/manage/api/admin/users/" + encodeURIComponent(id),
    { method: "PUT", body: JSON.stringify({ password }) },
    true
  )
}

export async function deleteUser(id: string): Promise<void> {
  await manageRequest("/manage/api/admin/users/" + encodeURIComponent(id), { method: "DELETE" }, true)
}

export async function runDiscoverNow(): Promise<boolean> {
  const data = await manageRequest<{ started: boolean }>("/manage/api/admin/discover/run", { method: "POST" }, true)
  return data.started
}
