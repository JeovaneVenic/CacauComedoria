import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { ResolvedPeriod } from "@/lib/periods"
import type { Unidade } from "@/schemas/inventory"

export interface StockItem {
  id: string
  nome: string
  unidade: Unidade
  quantidade: number
  quantidade_minima: number
  custo_unitario: number
  fornecedor_id: string | null
  ativo: boolean
  fornecedor: { nome: string } | null
}

export type MovementType = "entrada" | "saida" | "ajuste" | "consumo"

export interface StockMovement {
  id: string
  item_estoque_id: string
  tipo: MovementType
  quantidade: number
  custo_unitario: number | null
  motivo: string | null
  criado_em: string
  pedido: { numero: number } | null
  autor: { nome: string } | null
}

export interface RecipeProduct {
  id: string
  nome: string
  preco: number
  ativo: boolean
  categoria: { nome: string; ordem: number } | null
  ingredientes: { item_estoque_id: string; quantidade: number }[]
}

export interface StockSummary {
  totais: Partial<Record<MovementType, { n: number; valor: number }>>
  ajuste_liquido: number
  por_item: { id: string; nome: string; unidade: string; entrada: number; consumo: number; saida: number; ajuste: number; valor_saida: number }[]
}

const num = (v: unknown) => Number(v ?? 0)

/** Dados da tela Estoque (RLS: somente gestão). summary = null se a migração 008 ainda não rodou. */
export async function getInventory(period: ResolvedPeriod) {
  const supabase = await createClient()
  const [itens, movs, produtos, fornecedores, resumo] = await Promise.all([
    supabase
      .from("itens_estoque")
      .select("id, nome, unidade, quantidade, quantidade_minima, custo_unitario, fornecedor_id, ativo, fornecedor:fornecedores(nome)")
      .order("nome"),
    supabase
      .from("movimentacoes_estoque")
      .select(
        "id, item_estoque_id, tipo, quantidade, custo_unitario, motivo, criado_em, pedido:pedidos(numero), autor:usuarios!movimentacoes_estoque_criado_por_fkey(nome)"
      )
      .gte("criado_em", period.de)
      .lt("criado_em", period.ate)
      .order("criado_em", { ascending: false })
      .limit(500),
    supabase
      .from("produtos")
      .select("id, nome, preco, ativo, categoria:categorias(nome, ordem), ingredientes:produto_ingredientes(item_estoque_id, quantidade)")
      .order("nome"),
    supabase.from("fornecedores").select("id, nome, ativo").order("nome"),
    supabase.rpc("resumo_estoque", { p_inicio: period.inicio, p_fim: period.fim }),
  ])

  for (const r of [itens, movs, produtos, fornecedores]) if (r.error) throw r.error
  const missing = !!resumo.error && (resumo.error.code === "PGRST202" || resumo.error.code === "42883")
  if (resumo.error && !missing) throw resumo.error

  const items: StockItem[] = (itens.data ?? []).map((i) => ({
    ...(i as unknown as StockItem),
    quantidade: num(i.quantidade),
    quantidade_minima: num(i.quantidade_minima),
    custo_unitario: num(i.custo_unitario),
  }))
  const movements: StockMovement[] = (movs.data ?? []).map((m) => ({
    ...(m as unknown as StockMovement),
    quantidade: num(m.quantidade),
    custo_unitario: m.custo_unitario === null ? null : num(m.custo_unitario),
  }))
  const products: RecipeProduct[] = (produtos.data ?? [])
    .map((p) => {
      const raw = p as unknown as RecipeProduct
      return { ...raw, preco: num(raw.preco), ingredientes: (raw.ingredientes ?? []).map((g) => ({ ...g, quantidade: num(g.quantidade) })) }
    })
    .sort((a, b) => (a.categoria?.ordem ?? 99) - (b.categoria?.ordem ?? 99) || a.nome.localeCompare(b.nome, "pt-BR"))

  return {
    items,
    movements,
    products,
    suppliers: (fornecedores.data ?? []) as { id: string; nome: string; ativo: boolean }[],
    summary: missing ? null : (resumo.data as StockSummary),
    truncated: movements.length === 500,
  }
}
