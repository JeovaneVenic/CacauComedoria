"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/** true só depois que o React assumiu a página no navegador */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
