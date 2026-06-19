const FALLBACK = "#1a1614"

export function extractColor(src: string): Promise<string> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(FALLBACK)
      return
    }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(FALLBACK)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        let r = 0
        let g = 0
        let b = 0
        let count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        resolve("rgb(" + r + ", " + g + ", " + b + ")")
      } catch (e) {
        void e
        resolve(FALLBACK)
      }
    }
    img.onerror = () => resolve(FALLBACK)
    img.src = src
  })
}
