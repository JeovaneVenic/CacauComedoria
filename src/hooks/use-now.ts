"use client"

import { useContext, useEffect, useState } from "react"
import { ServerNowContext } from "@/components/providers/now-provider"

/** Relógio compartilhado para tempos decorridos ("há 12 min") sem re-render a cada segundo */
export function useNow(intervalMs = 30_000) {
  const serverNow = useContext(ServerNowContext)
  // começa no horário do servidor: o HTML e a hidratação mostram o mesmo texto
  const [now, setNow] = useState(() => new Date(serverNow ?? Date.now()))
  useEffect(() => {
    // logo após montar, passa à hora real do aparelho
    const first = setTimeout(() => setNow(new Date()), 0)
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [intervalMs])
  return now
}
