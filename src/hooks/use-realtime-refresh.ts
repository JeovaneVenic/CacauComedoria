"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export type LiveState = "connecting" | "live" | "offline"

interface Watch {
  table: string
  /** filtro do Realtime, ex.: "restaurante_id=eq.<uuid>" */
  filter?: string
}

interface Options {
  /** espera antes de recarregar (junta vários eventos seguidos) */
  delayMs?: number
  /**
   * Rede de segurança: recarrega a cada N ms enquanto a tela estiver visível,
   * mesmo sem evento do Realtime (conexão instável, evento perdido).
   */
  pollMs?: number
}

/**
 * Recarrega os dados do servidor (router.refresh) quando alguma das tabelas muda.
 * O RLS garante que só chegam eventos do próprio restaurante.
 */
export function useRealtimeRefresh(channelName: string, watches: Watch[], { delayMs = 300, pollMs }: Options = {}) {
  const router = useRouter()
  const [state, setState] = useState<LiveState>("connecting")
  const key = JSON.stringify(watches)

  useEffect(() => {
    const supabase = createClient()
    const list = JSON.parse(key) as Watch[]
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), delayMs)
    }

    let channel = supabase.channel(channelName)
    list.forEach((w) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: w.table, filter: w.filter }, refresh)
    })
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        setState("live")
        refresh() // recupera o que mudou enquanto a conexão estava caída
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setState("offline")
      }
    })

    // ao voltar para a aba (tablet que apagou a tela), busca o estado atual
    const onVisible = () => document.visibilityState === "visible" && refresh()
    document.addEventListener("visibilitychange", onVisible)
    const poll = pollMs
      ? setInterval(() => {
          if (document.visibilityState === "visible" && navigator.onLine) router.refresh()
        }, pollMs)
      : undefined

    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      document.removeEventListener("visibilitychange", onVisible)
      supabase.removeChannel(channel)
    }
  }, [channelName, key, delayMs, pollMs, router])

  return state
}
