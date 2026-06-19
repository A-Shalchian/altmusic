import type { Song } from "../api/types"
import { streamUrl } from "../api/subsonic"
import { getOfflineUrl } from "../lib/offline"
import { useOfflineStore } from "../store/offlineStore"
import { EQ_BANDS } from "../store/settingsStore"

interface Listener {
  onTime: (time: number, duration: number) => void
  onEnded: () => void
  getNext: () => Song | null
  onAdvance: () => void
}

class Engine {
  private ctx: AudioContext | null = null
  private els: HTMLAudioElement[] = []
  private srcs: MediaElementAudioSourceNode[] = []
  private gains: GainNode[] = []
  private filters: BiquadFilterNode[] = []
  private master: GainNode | null = null
  private active = 0
  private listener: Listener | null = null
  private songs: (Song | null)[] = [null, null]
  private blobUrls: (string | null)[] = [null, null]
  private fading = false

  private volume = 0.8
  private crossfade = 0
  private replayGain = false
  private preamp = 0
  private eqEnabled = false
  private eqGains: number[] = EQ_BANDS.map(() => 0)

  setup(listener: Listener) {
    this.listener = listener
    if (this.els.length) return
    for (let i = 0; i < 2; i++) {
      const el = new Audio()
      el.preload = "auto"
      el.addEventListener("timeupdate", () => this.onTime(i))
      el.addEventListener("ended", () => this.onEnded(i))
      el.addEventListener("loadedmetadata", () => {
        if (i === this.active && this.listener) this.listener.onTime(el.currentTime, el.duration || 0)
      })
      this.els.push(el)
    }
  }

  private ensureGraph() {
    if (this.ctx) return
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.filters = EQ_BANDS.map((freq, idx) => {
      const filt = ctx.createBiquadFilter()
      filt.type = idx === 0 ? "lowshelf" : idx === EQ_BANDS.length - 1 ? "highshelf" : "peaking"
      filt.frequency.value = freq
      filt.Q.value = 1
      filt.gain.value = 0
      return filt
    })
    for (let i = 0; i < this.filters.length - 1; i++) this.filters[i].connect(this.filters[i + 1])
    this.filters[this.filters.length - 1].connect(this.master)
    this.master.connect(ctx.destination)
    for (let i = 0; i < 2; i++) {
      const gain = ctx.createGain()
      gain.gain.value = i === this.active ? 1 : 0
      gain.connect(this.filters[0])
      this.gains[i] = gain
      const src = ctx.createMediaElementSource(this.els[i])
      src.connect(gain)
      this.srcs[i] = src
    }
    this.applyEq()
  }

  private trackGain(i: number): number {
    const song = this.songs[i]
    if (!this.replayGain || !song?.replayGain) return 1
    const gainDb = (song.replayGain.trackGain ?? 0) + this.preamp
    let factor = Math.pow(10, gainDb / 20)
    const peak = song.replayGain.trackPeak
    if (peak && peak > 0) factor = Math.min(factor, 1 / peak)
    return factor
  }

  private applyEq() {
    if (!this.filters.length) return
    for (let i = 0; i < this.filters.length; i++) {
      this.filters[i].gain.value = this.eqEnabled ? this.eqGains[i] ?? 0 : 0
    }
  }

  private async resolveSrc(song: Song): Promise<string> {
    if (useOfflineStore.getState().has(song.id)) {
      const offline = await getOfflineUrl(song.id)
      if (offline) return offline
    }
    return streamUrl(song.id)
  }

  currentSongId(): string | undefined {
    return this.songs[this.active]?.id
  }

  async load(song: Song, play: boolean) {
    this.ensureGraph()
    this.fading = false
    const i = this.active
    const other = 1 - this.active
    this.els[other].pause()
    if (this.blobUrls[i]) {
      URL.revokeObjectURL(this.blobUrls[i] as string)
      this.blobUrls[i] = null
    }
    this.songs[i] = song
    const src = await this.resolveSrc(song)
    if (this.currentSongId() !== song.id) {
      if (src.startsWith("blob:")) URL.revokeObjectURL(src)
      return
    }
    this.blobUrls[i] = src.startsWith("blob:") ? src : null
    this.els[i].src = src
    this.els[i].load()
    if (this.gains[i]) this.gains[i].gain.value = this.trackGain(i)
    if (this.gains[other]) this.gains[other].gain.value = 0
    if (play) this.play()
  }

  play() {
    this.ensureGraph()
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume()
    this.els[this.active]?.play().catch(() => undefined)
  }

  pause() {
    this.els[this.active]?.pause()
  }

  seek(time: number) {
    if (this.els[this.active]) this.els[this.active].currentTime = time
  }

  getCurrentTime(): number {
    return this.els[this.active]?.currentTime ?? 0
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }

  setSettings(opts: { crossfade: number; eqEnabled: boolean; eqGains: number[]; replayGain: boolean; preamp: number }) {
    this.crossfade = opts.crossfade
    this.eqEnabled = opts.eqEnabled
    this.eqGains = opts.eqGains
    this.replayGain = opts.replayGain
    this.preamp = opts.preamp
    this.applyEq()
    if (!this.fading && this.gains[this.active]) this.gains[this.active].gain.value = this.trackGain(this.active)
  }

  private onTime(i: number) {
    if (i !== this.active || this.fading) return
    const el = this.els[i]
    if (this.listener) this.listener.onTime(el.currentTime, el.duration || 0)
    if (this.crossfade > 0 && el.duration && el.duration - el.currentTime <= this.crossfade) {
      this.startCrossfade()
    }
  }

  private onEnded(i: number) {
    if (i !== this.active || this.fading) return
    if (this.listener) this.listener.onEnded()
  }

  private async startCrossfade() {
    if (this.fading || !this.ctx) return
    const next = this.listener?.getNext()
    if (!next) return
    this.fading = true
    const from = this.active
    const to = 1 - this.active
    if (this.blobUrls[to]) {
      URL.revokeObjectURL(this.blobUrls[to] as string)
      this.blobUrls[to] = null
    }
    this.songs[to] = next
    const src = await this.resolveSrc(next)
    this.blobUrls[to] = src.startsWith("blob:") ? src : null
    this.els[to].src = src
    this.els[to].currentTime = 0
    await this.els[to].play().catch(() => undefined)

    const now = this.ctx.currentTime
    const dur = this.crossfade
    const target = this.trackGain(to)
    this.gains[from].gain.cancelScheduledValues(now)
    this.gains[to].gain.cancelScheduledValues(now)
    this.gains[from].gain.setValueAtTime(this.gains[from].gain.value, now)
    this.gains[to].gain.setValueAtTime(0, now)
    this.gains[from].gain.linearRampToValueAtTime(0, now + dur)
    this.gains[to].gain.linearRampToValueAtTime(target, now + dur)

    window.setTimeout(() => {
      this.els[from].pause()
      this.songs[from] = null
      this.active = to
      this.fading = false
      this.listener?.onAdvance()
    }, dur * 1000)
  }
}

export const engine = new Engine()
