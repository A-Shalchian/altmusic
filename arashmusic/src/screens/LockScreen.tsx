import { useEffect, useState } from "react"
import { Delete } from "lucide-react"
import { useLockStore } from "../store/lockStore"

const PIN_LENGTH = 4

export function LockScreen() {
  const pinHash = useLockStore((s) => s.pinHash)
  const setPin = useLockStore((s) => s.setPin)
  const skipSetup = useLockStore((s) => s.skipSetup)
  const tryUnlock = useLockStore((s) => s.tryUnlock)

  const settingUp = pinHash === null
  const [entry, setEntry] = useState("")
  const [confirm, setConfirm] = useState("")
  const [stage, setStage] = useState<"create" | "verify">("create")
  const [error, setError] = useState("")

  useEffect(() => {
    if (entry.length < PIN_LENGTH) return

    if (!settingUp) {
      if (!tryUnlock(entry)) {
        setError("Wrong passcode")
        shake()
        setEntry("")
      }
      return
    }

    if (stage === "create") {
      setConfirm(entry)
      setStage("verify")
      setEntry("")
      return
    }

    if (entry === confirm) {
      setPin(entry)
    } else {
      setError("Passcodes did not match")
      shake()
      setEntry("")
      setConfirm("")
      setStage("create")
    }
  }, [entry])

  function shake() {
    window.navigator.vibrate?.(120)
  }

  function press(value: string) {
    setError("")
    if (entry.length < PIN_LENGTH) setEntry(entry + value)
  }

  function backspace() {
    setError("")
    setEntry(entry.slice(0, -1))
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        press(event.key)
      } else if (event.key === "Backspace") {
        event.preventDefault()
        backspace()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [entry])

  const heading = settingUp
    ? stage === "create"
      ? "Create a passcode"
      : "Confirm passcode"
    : "Enter passcode"

  return (
    <div className="screen-center">
      <div className="auth-card fade-up" style={{ alignItems: "center", maxWidth: 340 }}>
        <div className="auth-brand" style={{ justifyContent: "center" }}>
          <img src="/icon.svg" alt="arashmusic" />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{heading}</h1>

        <div className="pin-display">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} className={"pin-dot" + (i < entry.length ? " filled" : "")} />
          ))}
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <div className="pin-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button key={digit} className="pin-key" onClick={() => press(digit)}>
              {digit}
            </button>
          ))}
          <span />
          <button className="pin-key" onClick={() => press("0")}>
            0
          </button>
          <button className="pin-key muted" onClick={backspace} aria-label="Delete">
            <Delete size={20} />
          </button>
        </div>

        {settingUp ? (
          <button className="btn-ghost" onClick={skipSetup}>
            Skip for now
          </button>
        ) : null}
      </div>
    </div>
  )
}
