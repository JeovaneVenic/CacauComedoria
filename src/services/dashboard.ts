import "server-only"
import { createClient } from "@/lib/supabase/server"

export interface PeriodMetrics {
  faturamento: number
  pedidos: number
  cancelados: number
  mesas_atendidas: number
  ticket_medio: number
  despesas: number
  lucro: number
}

export interface DashboardData {
  hoje: string
  periodos: Record<"hoje" | "ontem" | "semana" | "semana_anterior" | "mes" | "mes_anterior", PeriodMetrics>
  serie_14_dias: { dia: string; faturamento: number; despesas: number }[]
  pedidos_status: Record<string, number>
  em_aberto: number
}

/** Indicadores calculados no banco (função resumo_dashboard, só gestão). null se a função ainda não existir. */
export async function getDashboard(): Promise<DashboardData | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("resumo_dashboard")
  if (error) {
    // PGRST202 / 42883: migração 006 ainda não aplicada no Supabase
    if (error.code === "PGRST202" || error.code === "42883") return null
    throw error
  }
  return data as DashboardData
}
