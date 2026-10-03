import "server-only"
import { createClient } from "@/lib/supabase/server"
import { startOfTodaySP } from "@/lib/format"
import type { OrderStatus } from "@/types/domain"

export interface OrderItem {
  id: string
  produto_id: string | null
  produto_nome: string
  quantidade: number
  preco_unitario: number
  observacao: string | null
  cancelado: boolean
  itens_pedido_opcoes: { opcao_nome: string }[]
}

/** Pedido com mesa, garçom, itens e os horários de cada etapa */
export interface OrderRow {
  id: string
  numero: number
  status: OrderStatus
  observacao: string | null
  subtotal: number
  motivo_cancelamento: string | null
  mesa_id: string
  atendimento_id: string
  garcom_id: string | null
  criado_em: string
  enviado_em: string | null
  preparo_iniciado_em: string | null
  pronto_em: string | null
  entregue_em: string | null
  finalizado_em: string | null
  cancelado_em: string | null
  mesa: { numero: number } | null
  garcom: { nome: string } | null
  itens_pedido: OrderItem[]
}

/** Mantido para a tela da mesa (mesmo formato) */
export type SessionOrder = OrderRow

const ORDER_SELECT = `
  id, numero, status, observacao, subtotal, motivo_cancelamento, mesa_id, atendimento_id, garcom_id,
  criado_em, enviado_em, preparo_iniciado_em, pronto_em, entregue_em, finalizado_em, cancelado_em,
  mesa:mesas!pedidos_mesa_id_fkey(numero),
  garcom:usuarios!pedidos_garcom_id_fkey(nome),
  itens_pedido(id, produto_id, produto_nome, quantidade, preco_unitario, observacao, cancelado, itens_pedido_opcoes(opcao_nome))
`

function normalize(rows: unknown[]) {
  return (rows as OrderRow[]).map((o) => ({
    ...o,
    subtotal: Number(o.subtotal),
    itens_pedido: [...o.itens_pedido]
      .map((i) => ({ ...i, preco_unitario: Number(i.preco_unitario) }))
      .sort((a, b) => Number(a.cancelado) - Number(b.cancelado)),
  }))
}

/** Pedidos do atendimento aberto de uma mesa, sem precisar buscar o atendimento antes */
export async function getOpenTableOrders(mesaId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("pedidos")
    .select(`${ORDER_SELECT}, sessao:atendimentos!pedidos_atendimento_id_fkey!inner(status)`)
    .eq("mesa_id", mesaId)
    .neq("sessao.status", "fechado")
    .order("criado_em", { ascending: false })
  if (error) throw error
  return normalize(data ?? [])
}

export type OrderPeriod = "hoje" | "2h" | "ativos"

/** Pedidos para o monitor: em andamento + os do período escolhido */
export async function getOrdersBoard(period: OrderPeriod = "hoje") {
  const supabase = await createClient()
  const active = "status.in.(aguardando_envio,novo,em_preparo,pronto,entregue)"
  const since = period === "2h" ? new Date(Date.now() - 2 * 3600 * 1000).toISOString() : startOfTodaySP()

  let query = supabase.from("pedidos").select(ORDER_SELECT).order("criado_em", { ascending: false }).limit(400)
  query = period === "ativos" ? query.or(active) : query.or(`${active},criado_em.gte.${since}`)
  const { data, error } = await query
  if (error) throw error
  return normalize(data ?? [])
}

/** Pedidos das mesas abertas pelo garçom logado (uma consulta só; o id vem do login, conferido localmente) */
export async function getWaiterOrders() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const garcomId = claims?.claims?.sub
  if (!garcomId) return []
  const { data, error } = await supabase
    .from("pedidos")
    .select(`${ORDER_SELECT}, sessao:atendimentos!pedidos_atendimento_id_fkey!inner(status, garcom_id)`)
    .eq("sessao.garcom_id", garcomId)
    .neq("sessao.status", "fechado")
    .order("criado_em", { ascending: false })
  if (error) throw error
  return normalize(data ?? [])
}

/** Fila da cozinha: novos, em preparo e prontos (ainda não entregues), do mais antigo ao mais novo */
export async function getKitchenOrders() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("pedidos")
    .select(ORDER_SELECT)
    .in("status", ["novo", "em_preparo", "pronto"])
    .order("enviado_em", { ascending: true })
    .limit(200)
  if (error) throw error
  return normalize(data ?? [])
}