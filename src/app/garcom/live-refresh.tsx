"use client"

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh"

/** Atualiza a página do servidor quando as tabelas mudam (sem recarregar) */
export function LiveRefresh({ channel, restaurantId, tables }: { channel: string; restaurantId: string; tables: string[] }) {
  useRealtimeRefresh(
    channel,
    tables.map((table) => ({ table, filter: `restaurante_id=eq.${restaurantId}` })),
    { pollMs: 15_000 }
  )
  return null
}
