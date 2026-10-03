"use client"

import { useCallback, useSyncExternalStore } from "react"

const EVENT = "cacau-flag-change"

function read(key: string) {
  try {
    return localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

/** Preferência liga/desliga salva no aparelho (ex.: som da cozinha). No servidor vale `false`. */
export function useStoredFlag(key: string) {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("storage", onChange)
    window.addEventListener(EVENT, onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener(EVENT, onChange)
    }
  }, [])

  const value = useSyncExternalStore(subscribe, () => read(key), () => false)

  const set = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0")
      } catch {
        // armazenamento indisponível: vale só nesta tela
      }
      window.dispatchEvent(new Event(EVENT))
    },
    [key]
  )

  return [value, set] as const
}
