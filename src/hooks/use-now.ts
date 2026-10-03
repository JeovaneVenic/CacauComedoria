"use client"

import { useEffect, useState } from "react"

/** Relógio compartilhado para tempos decorridos ("há 12 min") sem re-render a cada segundo */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
