export interface Song {
  id: string
  title: string
  album?: string
  albumId?: string
  artist?: string
  artistId?: string
  duration?: number
  track?: number
  year?: number
  genre?: string
  coverArt?: string
  starred?: string
  contentType?: string
  path?: string
  playCount?: number
  created?: string
  played?: string
  replayGain?: {
    trackGain?: number
    trackPeak?: number
    albumGain?: number
    albumPeak?: number
  }
}

export interface Album {
  id: string
  name: string
  artist?: string
  artistId?: string
  coverArt?: string
  songCount?: number
  duration?: number
  year?: number
  genre?: string
  starred?: string
  song?: Song[]
}

export interface Artist {
  id: string
  name: string
  coverArt?: string
  albumCount?: number
  album?: Album[]
}

export interface Playlist {
  id: string
  name: string
  comment?: string
  songCount?: number
  duration?: number
  coverArt?: string
  owner?: string
  entry?: Song[]
}

export interface SearchResult {
  artist: Artist[]
  album: Album[]
  song: Song[]
}

export interface LyricLine {
  start?: number
  value: string
}

export interface StructuredLyrics {
  synced: boolean
  offset?: number
  lang?: string
  line: LyricLine[]
}
