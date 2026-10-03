"use client"

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh"

/** Recarrega os dados da mesa quando a cozinha ou outro garçom muda algo */
export function TableLiveRefresh({
  restaurantId,
  tableId,
  sessionId,
}: {
  restaurantId: string
  tableId: string
  sessionId: string | null
}) {
  useRealtimeRefresh(
    `mesa:${tableId}`,
    [
      { table: "mesas", filter: `id=eq.${tableId}` },
      { table: "pedidos", filter: sessionId ? `atendimento_id=eq.${sessionId}` : `restaurante_id=eq.${restaurantId}` },
    ],
    { delayMs: 200, pollMs: 15_000 }
  )
  return null
}