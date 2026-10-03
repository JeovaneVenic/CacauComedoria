import "server-only"
import { createClient } from "@/lib/supabase/server"
import { getTableWithSession } from "@/services/tables"
import { getOpenTableOrders } from "@/services/orders"

/** Dados para fechar a conta de uma mesa aberta (null se a mesa estiver livre). Tudo em paralelo. */
export async function getCheckoutData(mesaId: string) {
  const supabase = await createClient()
  const [table, orders, { data: session }] = await Promise.all([
    getTableWithSession(mesaId),
    getOpenTableOrders(mesaId),
    supabase.from("atendimentos").select("id, taxa_servico_percentual, status").eq("mesa_id", mesaId).neq("status", "fechado").maybeSingle(),
  ])
  if (!table?.atendimento_id || !session) return { table, checkout: null }

  return {
    table,
    checkout: {
      atendimentoId: table.atendimento_id,
      orders,
      serviceFeePercent: Number(session.taxa_servico_percentual ?? 0),
      billRequested: session.status === "conta_solicitada",
    },
  }
}
