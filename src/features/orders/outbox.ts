"use client"

// Fila de pedidos do garçom.
// Um carrinho com `unconfirmed` = pedido que saiu (ou tentou sair) para a cozinha e ainda não
// teve confirmação. Ele fica travado com a MESMA chave de idempotência e é reenviado sozinho
// quando a internet volta: o banco devolve o pedido existente em vez de criar outro.

import { createClient } from "@/lib/supabase/client"
import { friendlyError } from "@/lib/errors"
import { useCartStore, type CartMeta, type TableCart } from "@/stores/cart-store"

export type SubmitOutcome =
  | { status: "sent"; numero: number; duplicado: boolean }
  | { status: "rejected"; message: string }
  | { status: "pending" }

// evita dois envios simultâneos do mesmo carrinho nesta aba
const inFlight = new Set<string>()

/** O banco respondeu com um erro definitivo (nada gravado) x falha de rede (resultado desconhecido) */
function serverRejected(error: { code?: string } | null) {
  if (!error?.code) return false
  // 23505 = a mesma chave chegou duas vezes ao mesmo tempo: o pedido existe, basta reenviar
  if (error.code === "23505") return false
  return /^[0-9A-Z]{5}$/.test(error.code) || error.code.startsWith("PGRST")
}

export async function submitCart(tableId: string, meta?: CartMeta): Promise<SubmitOutcome> {
  const store = useCartStore.getState()
  const cart = store.carts[tableId]
  if (!cart?.items.length) return { status: "rejected", message: "Adicione pelo menos um item ao pedido." }
  if (inFlight.has(tableId)) return { status: "pending" }

  // trava antes de sair pela rede: a partir daqui o pedido só muda se o banco recusar
  store.markUnconfirmed(tableId, true, meta)
  if (typeof navigator !== "undefined" && !navigator.onLine) return { status: "pending" }

  const current = useCartStore.getState().carts[tableId]!
  inFlight.add(tableId)
  try {
    const { data, error } = await createClient().rpc("enviar_pedido", {
      p_chave_idempotencia: current.key,
      p_mesa_id: tableId,
      p_itens: current.items.map((l) => ({
        produto_id: l.productId,
        quantidade: l.quantity,
        observacao: l.notes || null,
        opcoes_ids: l.optionIds,
      })),
      p_observacao: current.note.trim() || null,
      p_pessoas: current.pessoas ?? null,
    })
    if (error) {
      if (serverRejected(error)) {
        const message = friendlyError(error, "Não foi possível enviar o pedido.")
        useCartStore.getState().markUnconfirmed(tableId, false, { tableNumber: current.tableNumber ?? 0, pessoas: current.pessoas ?? null, error: message })
        return { status: "rejected", message }
      }
      return { status: "pending" }
    }
    const result = data as { numero: number; duplicado: boolean }
    useCartStore.getState().clear(tableId)
    return { status: "sent", numero: result.numero, duplicado: result.duplicado }
  } catch {
    return { status: "pending" }
  } finally {
    inFlight.delete(tableId)
  }
}

/** Pedidos aguardando confirmação, do mais antigo para o mais novo */
export function pendingOrders(carts: Record<string, TableCart>) {
  return Object.entries(carts)
    .filter(([, c]) => c.unconfirmed && c.items.length > 0)
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt)
}
