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

async function manageRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artist, title })
  }).catch(() => undefined)
}

export async function dismissTrack(artist: string, title?: string): Promise<void> {
  await manageRequest("/manage/api/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artist, title })
  }).catch(() => undefined)
}

export async function pullTrack(artist: string, title: string): Promise<string> {
  const data = await manageRequest<{ jobId: string }>("/manage/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artist, title })
  })
  return data.jobId
}
