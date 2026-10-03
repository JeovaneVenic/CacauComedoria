"use client"

// Chamadas às funções do banco. Toda regra (papel, transição de status,
// valores) é validada no servidor; aqui só traduzimos o resultado.
import { createClient } from "@/lib/supabase/client"
import { friendlyError } from "@/lib/errors"
import type { ActionResult } from "@/lib/action"
import type { OrderStatus } from "@/types/domain"

async function call<T = undefined>(fn: string, args: Record<string, unknown>, fallback: string): Promise<ActionResult<T>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "Sem conexão. Verifique a internet e tente novamente." }
  }
  const { data, error } = await createClient().rpc(fn, args)
  if (error) return { ok: false, error: friendlyError(error, fallback) }
  return { ok: true, data: data as T }
}

export const updateOrderStatus = (pedidoId: string, status: OrderStatus, motivo?: string) =>
  call("atualizar_status_pedido", { p_pedido_id: pedidoId, p_status: status, p_motivo: motivo ?? null }, "Não foi possível atualizar o pedido.")

export const cancelOrderItem = (itemId: string, motivo?: string) =>
  call("cancelar_item_pedido", { p_item_id: itemId, p_motivo: motivo ?? null }, "Não foi possível cancelar o item.")

export interface NewItem {
  produto_id: string
  quantidade: number
  observacao: string | null
  opcoes_ids: string[]
}

export const addOrderItems = (pedidoId: string, itens: NewItem[]) =>
  call("adicionar_itens_pedido", { p_pedido_id: pedidoId, p_itens: itens }, "Não foi possível adicionar os itens.")

export const requestBill = (atendimentoId: string) =>
  call("solicitar_conta", { p_atendimento_id: atendimentoId }, "Não foi possível solicitar a conta.")

export interface Payment {
  forma: "dinheiro" | "pix" | "credito" | "debito" | "vale" | "outro"
  valor: number
}

export const closeTable = (atendimentoId: string, pagamentos: Payment[], desconto: number, semServico: boolean) =>
  call<{ total: number; troco: number }>(
    "fechar_mesa",
    { p_atendimento_id: atendimentoId, p_pagamentos: pagamentos, p_desconto: desconto, p_sem_servico: semServico },
    "Não foi possível fechar a mesa."
  )
