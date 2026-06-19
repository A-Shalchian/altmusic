function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((x) => clampByte(x).toString(16).padStart(2, "0")).join("")
}

function mix(rgb: [number, number, number], t: number, target: number): [number, number, number] {
  return [rgb[0] + (target - rgb[0]) * t, rgb[1] + (target - rgb[1]) * t, rgb[2] + (target - rgb[2]) * t]
}

export function applyAccent(hex: string) {
  let rgb: [number, number, number]
  try {
    rgb = hexToRgb(hex)
  } catch {
    return
  }
  const root = document.documentElement.style
  root.setProperty("--accent", hex)
  root.setProperty("--accent-bright", toHex(mix(rgb, 0.22, 255)))
  root.setProperty("--accent-deep", toHex(mix(rgb, 0.25, 0)))
  root.setProperty("--accent-glow", "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 0.16)")
}
