"use client"

import { useEffect } from "react"

/**
 * Registra o service worker (app instalável + telas offline).
 * Só em produção: no modo de desenvolvimento ele guardaria arquivos que mudam a cada edição.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // sem service worker o app funciona normalmente, só não abre offline
    })
  }, [])
  return null
}
