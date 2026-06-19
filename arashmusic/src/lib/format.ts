export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00"
  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return mins + ":" + secs.toString().padStart(2, "0")
}

export function formatCount(count: number | undefined, noun: string): string {
  const value = count ?? 0
  return value + " " + noun + (value === 1 ? "" : "s")
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB"
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return (mb / 1024).toFixed(2) + " GB"
  return mb.toFixed(1) + " MB"
}
