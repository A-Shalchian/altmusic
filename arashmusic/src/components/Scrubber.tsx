import type * as React from "react"
import { useRef } from "react"

interface ScrubberProps {
  value: number
  max: number
  onSeek: (value: number) => void
}

export function Scrubber({ value, max, onSeek }: ScrubberProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const ratio = max > 0 ? Math.min(1, value / max) : 0

  function seekFromEvent(clientX: number) {
    const el = trackRef.current
    if (!el || max <= 0) return
    const rect = el.getBoundingClientRect()
    const next = ((clientX - rect.left) / rect.width) * max
    onSeek(Math.max(0, Math.min(max, next)))
  }

  function onPointerDown(event: React.PointerEvent) {
    seekFromEvent(event.clientX)
    function move(e: PointerEvent) {
      seekFromEvent(e.clientX)
    }
    function up() {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <div className="scrub" ref={trackRef} onPointerDown={onPointerDown}>
      <div className="scrub-track">
        <div className="scrub-fill" style={{ width: ratio * 100 + "%" }} />
        <div className="scrub-knob" style={{ left: ratio * 100 + "%" }} />
      </div>
    </div>
  )
}
