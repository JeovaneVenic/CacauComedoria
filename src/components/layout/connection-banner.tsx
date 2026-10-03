"use client"

import { WifiOff } from "lucide-react"
import { useOnline } from "@/hooks/use-online"

/** Faixa fixa quando o aparelho perde a internet */
export function ConnectionBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="alert"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-destructive px-4 py-2.5 text-sm font-bold text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      Sem conexão — as informações podem estar desatualizadas.
    </div>
  )
}
