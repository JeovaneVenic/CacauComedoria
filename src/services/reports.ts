import "server-only"
import { createClient } from "@/lib/supabase/server"
import { friendlyError } from "@/lib/errors"
import type { ResolvedPeriod } from "@/lib/periods"
import type { FormaPagamento } from "@/schemas/common"

export interface ReportData {
  periodo: { inicio: string; fim: string }
  resumo: {
    faturamento: number
    despesas: number
    pedidos: number
    cancelados: number
    itens: number
    mesas_atendidas: number
    pessoas: number
  }
  por_dia: { dia: string; faturamento: number; despesas: number; pedidos: number }[]
  por_hora: { hora: number; pedidos: number; receita: number }[]
  produtos: { nome: string; categoria: string; quantidade: number; receita: number }[]
  categorias: { nome: string; quantidade: number; receita: number }[]
  garcons: { nome: string; pedidos: number; receita: number; ticket_medio: number; mesas: number }[]
  mesas: { numero: number; atendimentos: number; pessoas: number; receita: number; permanencia_min: number | null }[]
  pedidos: {
    status: Record<string, number>
    preparo_medio_min: number | null
    espera_media_min: number | null
    motivos_cancelamento: { motivo: string; n: number }[]
  }
  formas_pagamento: { forma: FormaPagamento; valor: number; n: number }[]
  despesas_categoria: { nome: string; tipo: string; valor: number; n: number }[]
}

export type ReportResult = { status: "ok"; data: ReportData } | { status: "missing" } | { status: "error"; message: string }

/** Relatório agregado no banco (função relatorio, só gestão). */
export async function getReport(period: ResolvedPeriod): Promise<ReportResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("relatorio", { p_inicio: period.inicio, p_fim: period.fim })
  if (error) {
    // migração 007 ainda não aplicada no Supabase
    if (error.code === "PGRST202" || error.code === "42883") return { status: "missing" }
    return { status: "error", message: friendlyError(error, "Não foi possível gerar o relatório.") }
  }
  return { status: "ok", data: data as ReportData }
}
