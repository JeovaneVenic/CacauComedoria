// Acesso direto à API do Supabase como um usuário de teste: usado para preparar e conferir dados,
// nunca para substituir o que o teste precisa exercitar pela interface.
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { SENHA, SUPABASE_KEY, SUPABASE_URL, USUARIOS, type Perfil } from "./env"

const clientes = new Map<string, SupabaseClient>()

export async function apiComo(perfil: Perfil | "anonimo"): Promise<SupabaseClient> {
  const cached = clientes.get(perfil)
  if (cached) return cached
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  if (perfil !== "anonimo") {
    const { error } = await client.auth.signInWithPassword({ email: USUARIOS[perfil].email, password: SENHA })
    if (error) throw new Error(`login de ${perfil} pela API falhou: ${error.message}`)
  }
  clientes.set(perfil, client)
  return client
}

export async function mesaPorNumero(numero: number) {
  const api = await apiComo("dono")
  const { data, error } = await api.from("visao_mesas").select("*").eq("numero", numero).eq("ativa", true).single()
  if (error) throw error
  return data as { id: string; numero: number; status: string; atendimento_id: string | null; subtotal: number }
}

/**
 * Deixa a mesa livre: leva os pedidos abertos até "entregue" e fecha a conta em Pix
 * (como a gerência faria). Usado só para preparar o cenário do fluxo completo.
 */
export async function liberarMesa(numero: number) {
  const api = await apiComo("dono")
  const mesa = await mesaPorNumero(numero)
  if (!mesa.atendimento_id) return mesa

  const { data: pedidos, error } = await api.from("pedidos").select("id, status").eq("atendimento_id", mesa.atendimento_id)
  if (error) throw error
  const proximo: Record<string, string> = { aguardando_envio: "novo", novo: "em_preparo", em_preparo: "pronto", pronto: "entregue" }
  for (const p of pedidos ?? []) {
    let status = p.status as string
    while (proximo[status]) {
      const { error: e } = await api.rpc("atualizar_status_pedido", { p_pedido_id: p.id, p_status: proximo[status], p_motivo: null })
      if (e) throw new Error(`não consegui avançar o pedido ${p.id}: ${e.message}`)
      status = proximo[status]
    }
  }
  const { data: totais, error: et } = await api.rpc("totais_atendimento", { p_atendimento_id: mesa.atendimento_id })
  if (et) throw et
  const total = Number((totais as { total?: number }[] | null)?.[0]?.total ?? 0)
  const { error: ef } = await api.rpc("fechar_mesa", {
    p_atendimento_id: mesa.atendimento_id,
    p_pagamentos: total > 0 ? [{ forma: "pix", valor: total }] : [],
    p_desconto: 0,
    p_sem_servico: false,
  })
  if (ef) throw new Error(`não consegui fechar a mesa ${numero}: ${ef.message}`)
  return mesaPorNumero(numero)
}
