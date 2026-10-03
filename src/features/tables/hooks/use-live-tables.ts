"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TableOverview } from "@/types/domain"

export type RealtimeState = "connecting" | "live" | "offline"

/**
 * Mapa de mesas sincronizado em tempo real.
 * Escuta mesas, sessões e pedidos do restaurante (o RLS filtra no servidor)
 * e recarrega a visão agregada com debounce para aguentar o pico do salão.
 */
export function useLiveTables(restaurantId: string, initial: TableOverview[]) {
  const [tables, setTables] = useState(initial)
  const [state, setState] = useState<RealtimeState>("connecting")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dados novos do servidor (router.refresh) substituem o estado local
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setTables(initial)
  }

  const refetch = useCallback(async () => {
    const { data, error } = await createClient()
      .from("visao_mesas")
      .select("*")
      .eq("ativa", true)
      .order("numero")
    if (!error && data) setTables(data as TableOverview[])
  }, [])

  const scheduleRefetch = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(refetch, 250)
  }, [refetch])

  useEffect(() => {
    const supabase = createClient()
    const filter = `restaurante_id=eq.${restaurantId}`
    const channel = supabase
      .channel(`mesas:${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas", filter }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos", filter }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter }, scheduleRefetch)
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setState("live")
          scheduleRefetch() // recupera o que mudou enquanto a conexão caiu
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setState("offline")
        }
      })

    // rede de segurança: confere o salão a cada 20 s com a tela visível e ao voltar para a aba
    const onVisible = () => document.visibilityState === "visible" && scheduleRefetch()
    document.addEventListener("visibilitychange", onVisible)
    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) refetch()
    }, 20_000)

    return () => {
      if (timer.current) clearTimeout(timer.current)
      clearInterval(poll)
      document.removeEventListener("visibilitychange", onVisible)
      supabase.removeChannel(channel)
    }
  }, [restaurantId, scheduleRefetch, refetch])

  return { tables, state, refetch }
}
