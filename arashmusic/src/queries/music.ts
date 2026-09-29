import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import * as api from "../api/subsonic"
import { getMe, getRecommendations, webSearch } from "../api/manage"

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

export function useArtistSongs(id: string | undefined) {
  return useQuery({
    queryKey: ["artistSongs", id],
    queryFn: () => api.getArtistSongs(id as string),
    enabled: Boolean(id)
  })
}

export function useEntireLibrary() {
  return useQuery({
    queryKey: ["entireLibrary"],
    queryFn: () => api.getEntireLibrary(),
    staleTime: 120000
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

export function useRecommendations() {
  return useQuery({
    queryKey: ["recommendations"],
    queryFn: () => getRecommendations(),
    staleTime: 10 * 60 * 1000,
    retry: 1
  })
}

export function useWebSearch(query: string) {
  return useQuery({
    queryKey: ["webSearch", query],
    queryFn: () => webSearch(query),
    enabled: query.trim().length > 1,
    staleTime: 5 * 60 * 1000,
    retry: 1
  })
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => getMe(),
    staleTime: 30 * 60 * 1000,
    retry: 1
  })
}
