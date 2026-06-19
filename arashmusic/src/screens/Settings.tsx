import { useSettingsStore } from "../store/settingsStore"

const CROSSFADE_OPTIONS = [0, 2, 4, 6, 8, 12]

export function Settings() {
  const crossfade = useSettingsStore((s) => s.crossfade)
  const setCrossfade = useSettingsStore((s) => s.setCrossfade)

  return (
    <div className="content fade-up">
      <h1 className="greeting">Settings</h1>

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
    </div>
  )
}
