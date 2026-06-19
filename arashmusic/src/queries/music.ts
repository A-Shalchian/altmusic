import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import * as api from "../api/subsonic"

const SONGS_PAGE = 200

export function useAllSongs() {
  return useInfiniteQuery({
    queryKey: ["allSongs"],
    queryFn: ({ pageParam }) => api.getAllSongs(pageParam, SONGS_PAGE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === SONGS_PAGE ? allPages.length * SONGS_PAGE : undefined
  })
}

export function useAlbumList(type: string, size = 24) {
  return useQuery({
    queryKey: ["albumList", type, size],
    queryFn: () => api.getAlbumList(type, size)
  })
}

export function useAlbum(id: string | undefined) {
  return useQuery({
    queryKey: ["album", id],
    queryFn: () => api.getAlbum(id as string),
    enabled: Boolean(id)
  })
}

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.getPlaylists()
  })
}

export function usePlaylist(id: string | undefined) {
  return useQuery({
    queryKey: ["playlist", id],
    queryFn: () => api.getPlaylist(id as string),
    enabled: Boolean(id)
  })
}

export function useArtists() {
  return useQuery({
    queryKey: ["artists"],
    queryFn: () => api.getArtists()
  })
}

export function useStarred() {
  return useQuery({
    queryKey: ["starred"],
    queryFn: () => api.getStarred()
  })
}

export function useRandomSongs(size = 50) {
  return useQuery({
    queryKey: ["randomSongs", size],
    queryFn: () => api.getRandomSongs(size)
  })
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query),
    enabled: query.trim().length > 0
  })
}
