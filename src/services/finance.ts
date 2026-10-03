import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { ResolvedPeriod } from "@/lib/periods"
import type { FormaPagamento } from "@/schemas/common"

export type ExpenseType = "fixa" | "variavel" | "operacional"

export interface ExpenseCategory {
  id: string
  nome: string
  tipo: ExpenseType
}

export interface Supplier {
  id: string
  nome: string
  documento: string | null
  telefone: string | null
  email: string | null
  observacao: string | null
  ativo: boolean
}

export interface Expense {
  id: string
  descricao: string
  valor: number
  data: string
  forma_pagamento: FormaPagamento
  observacao: string | null
  comprovante_caminho: string | null
  categoria_id: string
  fornecedor_id: string | null
  criado_em: string
  categoria: { nome: string; tipo: ExpenseType } | null
  fornecedor: { nome: string } | null
  autor: { nome: string } | null
}

export interface FinanceSummary {
  receita: number
  despesas: number
  custoMercadoria: number
  lucroBruto: number
  lucroEstimado: number
  pedidos: number
  ticketMedio: number
  porTipo: Record<ExpenseType, number>
  porCategoria: { nome: string; tipo: ExpenseType; valor: number }[]
  porForma: { forma: FormaPagamento; valor: number }[]
}

/** Dados da tela Financeiro para o período (RLS: somente gestão lê pagamentos e despesas) */
export async function getFinance(period: ResolvedPeriod) {
  const supabase = await createClient()
  const [pagamentos, despesas, pedidos, categorias, fornecedores] = await Promise.all([
    fetchPayments(supabase, period),
    supabase
      .from("despesas")
      .select(
        `id, descricao, valor, data, forma_pagamento, observacao, comprovante_caminho, categoria_id, fornecedor_id, criado_em,
         categoria:categorias_despesa(nome, tipo),
         fornecedor:fornecedores(nome),
         autor:usuarios!despesas_criado_por_fkey(nome)`
      )
      .gte("data", period.inicio)
      .lte("data", period.fim)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false }),
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .gte("criado_em", period.de)
      .lt("criado_em", period.ate)
      .not("status", "in", "(cancelado,devolvido)"),
    supabase.from("categorias_despesa").select("id, nome, tipo").order("nome"),
    supabase.from("fornecedores").select("*").order("ativo", { ascending: false }).order("nome"),
  ])
  const error = pagamentos.error ?? despesas.error ?? pedidos.error ?? categorias.error ?? fornecedores.error
  if (error) throw error

  const expenses = (despesas.data ?? []).map((d) => ({ ...d, valor: Number(d.valor) })) as unknown as Expense[]
  const receita = round((pagamentos.data ?? []).reduce((s, p) => s + Number(p.valor), 0))
  const totalDespesas = round(expenses.reduce((s, e) => s + e.valor, 0))

  const porTipo: Record<ExpenseType, number> = { fixa: 0, variavel: 0, operacional: 0 }
  const cat = new Map<string, { nome: string; tipo: ExpenseType; valor: number }>()
  for (const e of expenses) {
    const tipo = e.categoria?.tipo ?? "variavel"
    porTipo[tipo] = round(porTipo[tipo] + e.valor)
    const key = e.categoria?.nome ?? "Sem categoria"
    const cur = cat.get(key) ?? { nome: key, tipo, valor: 0 }
    cur.valor = round(cur.valor + e.valor)
    cat.set(key, cur)
  }

  const forma = new Map<FormaPagamento, number>()
  for (const p of pagamentos.data ?? []) forma.set(p.forma as FormaPagamento, round((forma.get(p.forma as FormaPagamento) ?? 0) + Number(p.valor)))

  const nPedidos = pedidos.count ?? 0
  const summary: FinanceSummary = {
    receita,
    despesas: totalDespesas,
    // custo de mercadoria = despesas variáveis (alimentos, bebidas, fornecedores)
    custoMercadoria: porTipo.variavel,
    lucroBruto: round(receita - porTipo.variavel),
    lucroEstimado: round(receita - totalDespesas),
    pedidos: nPedidos,
    ticketMedio: nPedidos ? round(receita / nPedidos) : 0,
    porTipo,
    porCategoria: [...cat.values()].sort((a, b) => b.valor - a.valor),
    porForma: [...forma.entries()].map(([f, valor]) => ({ forma: f, valor })).sort((a, b) => b.valor - a.valor),
  }

  return {
    summary,
    expenses,
    categories: (categorias.data ?? []) as ExpenseCategory[],
    suppliers: (fornecedores.data ?? []) as Supplier[],
  }
}

/** O Supabase devolve até 1.000 linhas por consulta: busca em lotes para o total não sair cortado */
async function fetchPayments(supabase: Awaited<ReturnType<typeof createClient>>, period: ResolvedPeriod) {
  const rows: { forma: string; valor: number }[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("forma, valor")
      .gte("criado_em", period.de)
      .lt("criado_em", period.ate)
      .order("criado_em")
      .range(from, from + size - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < size) return { data: rows, error: null }
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100
}
