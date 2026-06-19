import { md5 } from "js-md5"
import { create } from "zustand"
import { persist } from "zustand/middleware"

const PIN_SALT = "arashmusic-pin"

function hashPin(pin: string): string {
  return md5(pin + PIN_SALT)
}

interface LockState {
  pinHash: string | null
  unlocked: boolean
  setupMode: boolean
  setPin: (pin: string) => void
  removePin: () => void
  requestSetup: () => void
  skipSetup: () => void
  tryUnlock: (pin: string) => boolean
  lock: () => void
}

export const useLockStore = create<LockState>()(
  persist(
    (set, get) => ({
      pinHash: null,
      unlocked: false,
      setupMode: false,
      setPin: (pin) => set({ pinHash: hashPin(pin), unlocked: true, setupMode: false }),
      removePin: () => set({ pinHash: null, unlocked: true, setupMode: false }),
      requestSetup: () => set({ setupMode: true }),
      skipSetup: () => set({ setupMode: false, unlocked: true }),
      tryUnlock: (pin) => {
        const match = get().pinHash === hashPin(pin)
        if (match) set({ unlocked: true })
        return match
      },
      lock: () => set({ unlocked: false })
    }),
    {
      name: "arashmusic-lock",
      partialize: (state) => ({ pinHash: state.pinHash })
    }
  )
)
