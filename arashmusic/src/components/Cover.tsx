import { Disc3 } from "lucide-react"
import { coverArtUrl } from "../api/subsonic"

interface CoverProps {
  coverArt?: string
  size: number
  className: string
  alt: string
}

export function Cover({ coverArt, size, className, alt }: CoverProps) {
  if (!coverArt) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center" }}>
        <Disc3 size={Math.round(size * 0.34)} color="#6f6a64" />
      </div>
    )
  }
  return <img className={className} src={coverArtUrl(coverArt, size)} alt={alt} loading="lazy" />
}
