import { EQ_BANDS, useSettingsStore } from "../store/settingsStore"
import { ACCENT_PRESETS, useThemeStore } from "../store/themeStore"

const CROSSFADE_OPTIONS = [0, 2, 4, 6, 8, 12]

function bandLabel(freq: number): string {
  if (freq >= 1000) {
    const k = freq / 1000
    return (Number.isInteger(k) ? k : k.toFixed(1)) + "k"
  }
  return freq + ""
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={"toggle" + (on ? " on" : "")} onClick={onClick} role="switch" aria-checked={on}>
      <span className="toggle-knob" />
    </button>
  )
}

export function Settings() {
  const crossfade = useSettingsStore((s) => s.crossfade)
  const setCrossfade = useSettingsStore((s) => s.setCrossfade)
  const eqEnabled = useSettingsStore((s) => s.eqEnabled)
  const eqGains = useSettingsStore((s) => s.eqGains)
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled)
  const setEqGain = useSettingsStore((s) => s.setEqGain)
  const resetEq = useSettingsStore((s) => s.resetEq)
  const replayGain = useSettingsStore((s) => s.replayGain)
  const setReplayGain = useSettingsStore((s) => s.setReplayGain)
  const preamp = useSettingsStore((s) => s.preamp)
  const setPreamp = useSettingsStore((s) => s.setPreamp)
  const accent = useThemeStore((s) => s.accent)
  const setAccent = useThemeStore((s) => s.setAccent)

  return (
    <div className="content fade-up">
      <h1 className="greeting">Settings</h1>

      <section className="settings-section">
        <h2 className="settings-title">Accent color</h2>
        <p className="settings-desc">Pick the highlight color used across the app.</p>
        <div className="swatch-row">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              className={"swatch" + (accent.toLowerCase() === color.toLowerCase() ? " on" : "")}
              style={{ background: color }}
              onClick={() => setAccent(color)}
              aria-label={"Accent " + color}
            />
          ))}
          <label className="swatch swatch-custom" aria-label="Custom color">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-title">Crossfade</h2>
        <p className="settings-desc">Blend the end of one track into the start of the next.</p>
        <div className="chip-row">
          {CROSSFADE_OPTIONS.map((sec) => (
            <button
              key={sec}
              className={"chip-btn" + (crossfade === sec ? " on" : "")}
              onClick={() => setCrossfade(sec)}
            >
              {sec === 0 ? "Off" : sec + "s"}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-head">
          <div>
            <h2 className="settings-title">Equalizer</h2>
            <p className="settings-desc">Shape the sound across frequency bands.</p>
          </div>
          <Toggle on={eqEnabled} onClick={() => setEqEnabled(!eqEnabled)} />
        </div>
        <div className={"eq-grid" + (eqEnabled ? "" : " disabled")}>
          {EQ_BANDS.map((freq, i) => (
            <div key={freq} className="eq-band">
              <span className="eq-val">{eqGains[i] > 0 ? "+" : ""}{eqGains[i]}</span>
              <input
                className="eq-slider"
                type="range"
                min={-12}
                max={12}
                step={1}
                value={eqGains[i]}
                disabled={!eqEnabled}
                onChange={(e) => setEqGain(i, Number(e.target.value))}
              />
              <span className="eq-freq">{bandLabel(freq)}</span>
            </div>
          ))}
        </div>
        <button className="btn-ghost" style={{ marginTop: 14 }} onClick={resetEq}>
          Reset to flat
        </button>
      </section>

      <section className="settings-section">
        <div className="settings-head">
          <div>
            <h2 className="settings-title">Volume normalization</h2>
            <p className="settings-desc">Even out loudness between tracks using ReplayGain tags.</p>
          </div>
          <Toggle on={replayGain} onClick={() => setReplayGain(!replayGain)} />
        </div>
        <div className={"preamp-row" + (replayGain ? "" : " disabled")}>
          <span className="preamp-label">Pre-amp</span>
          <input
            className="eq-slider wide"
            type="range"
            min={-6}
            max={6}
            step={1}
            value={preamp}
            disabled={!replayGain}
            onChange={(e) => setPreamp(Number(e.target.value))}
          />
          <span className="eq-val">{preamp > 0 ? "+" : ""}{preamp} dB</span>
        </div>
      </section>
    </div>
  )
}
