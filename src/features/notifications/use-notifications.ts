"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { playReadyChime } from "@/lib/sounds"
import type { AppRole } from "@/types/domain"

export interface AppNotification {
  id: string
  tipo: string
  titulo: string
  mensagem: string | null
  dados: Record<string, string>
  lida_em: string | null
  criado_em: string
}

/**
 * Tipos que cada papel acompanha no sino.
 * "pedido.novo" fica fora: a cozinha tem o próprio alarme e a gestão vê no monitor.
 */
const TYPES_BY_ROLE: Record<"gestao" | "salao", string[]> = {
  gestao: ["mesa.conta_solicitada", "estoque.baixo", "despesa.nova"],
  salao: ["pedido.pronto", "mesa.conta_solicitada"],
}

const POLL_MS = 15_000

/**
 * Notificações do usuário em tempo real (o RLS entrega só as do restaurante
 * e as destinadas ao papel/usuário). Sem Realtime, a consulta periódica cobre.
 */
export function useNotifications(restaurantId: string, role: AppRole) {
  const group = role === "proprietario" || role === "gerente" || role === "administrador" ? "gestao" : "salao"
  const types = TYPES_BY_ROLE[group]
  const [items, setItems] = useState<AppNotification[]>([])
  const known = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("notificacoes")
      .select("id, tipo, titulo, mensagem, dados, lida_em, criado_em")
      .in("tipo", types)
      .order("criado_em", { ascending: false })
      .limit(30)
    if (error || !data) return
    const list = data as AppNotification[]

    // primeira carga: só registra; depois, avisa o que é novo
    if (known.current === null) {
      known.current = new Set(list.map((n) => n.id))
    } else {
      const fresh = list.filter((n) => !known.current!.has(n.id)).reverse()
      fresh.forEach((n) => {
        known.current!.add(n.id)
        const show = n.tipo === "pedido.pronto" ? toast.success : n.tipo === "estoque.baixo" ? toast.warning : toast.info
        show(n.titulo, { description: n.mensagem ?? undefined, duration: n.tipo === "pedido.pronto" ? 10_000 : 6_000 })
      })
      if (fresh.some((n) => n.tipo === "pedido.pronto")) playReadyChime()
    }
    setItems(list)
  }, [types])

  useEffect(() => {
    const supabase = createClient()
    const first = setTimeout(load, 0)
    const channel = supabase
      .channel(`notificacoes:${restaurantId}:${group}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `restaurante_id=eq.${restaurantId}` }, () => load())
      // a cada (re)conexão busca o que pode ter chegado enquanto estava fora
      .subscribe((status: string) => status === "SUBSCRIBED" && load())
    // consulta leve que roda mesmo em segundo plano: o som de "pedido pronto" precisa tocar
    const poll = setInterval(() => {
      if (navigator.onLine) load()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(first)
      clearInterval(poll)
      document.removeEventListener("visibilitychange", onVisible)
      supabase.removeChannel(channel)
    }
  }, [restaurantId, group, load])

  const unread = items.filter((n) => !n.lida_em)

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => !n.lida_em).map((n) => n.id)
    if (!ids.length) return
    const now = new Date().toISOString()
    setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, lida_em: now } : n)))
    await createClient().from("notificacoes").update({ lida_em: now }).in("id", ids)
  }, [items])

  return { items, unread, markAllRead }
}
