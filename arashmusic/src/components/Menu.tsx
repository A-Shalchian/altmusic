import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

export interface MenuItem {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

interface MenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

const MENU_WIDTH = 210

export function Menu({ x, y, items, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onClose, true)
    window.addEventListener("resize", onClose)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onClose, true)
      window.removeEventListener("resize", onClose)
    }
  }, [onClose])

  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 12)
  const estimatedHeight = items.length * 42 + 12
  const top = Math.min(y, window.innerHeight - estimatedHeight - 12)

  return createPortal(
    <div className="menu" ref={ref} style={{ left, top, width: MENU_WIDTH }}>
      {items.map((item, index) => (
        <button
          key={index}
          className={"menu-item" + (item.danger ? " danger" : "")}
          onClick={() => {
            item.onClick()
            onClose()
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
