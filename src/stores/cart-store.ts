"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/** Uma linha do pedido em montagem no tablet */
export interface CartLine {
  lineId: string
  productId: string
  name: string
  /** preço unitário já com os acréscimos das opções */
  unitPrice: number
  quantity: number
  optionIds: string[]
  optionLabels: string[]
  notes: string
}

export interface TableCart {
  /** chave de idempotência: o mesmo pedido reenviado nunca vira dois */
  key: string
  items: CartLine[]
  note: string
  /**
   * true depois de uma tentativa de envio sem confirmação (ex.: internet caiu).
   * Enquanto isso o carrinho fica travado e só pode ser reenviado com a mesma chave.
   */
  unconfirmed: boolean
  updatedAt: number
  /** dados para o envio automático pela fila (sem precisar da tela da mesa aberta) */
  tableNumber?: number
  pessoas?: number | null
  /** recusa do servidor na última tentativa (ex.: produto indisponível) */
  error?: string
}

export interface CartMeta {
  tableNumber: number
  pessoas: number | null
}

interface CartState {
  carts: Record<string, TableCart>
  addLine: (tableId: string, line: Omit<CartLine, "lineId">) => void
  setQuantity: (tableId: string, lineId: string, quantity: number) => void
  removeLine: (tableId: string, lineId: string) => void
  setNote: (tableId: string, note: string) => void
  markUnconfirmed: (tableId: string, unconfirmed: boolean, meta?: CartMeta & { error?: string }) => void
  clear: (tableId: string) => void
}

function emptyCart(): TableCart {
  return { key: crypto.randomUUID(), items: [], note: "", unconfirmed: false, updatedAt: Date.now() }
}

/** Mesmo produto + mesmas opções + mesma observação = mesma linha (soma a quantidade) */
function sameLine(a: Omit<CartLine, "lineId">, b: CartLine) {
  return (
    a.productId === b.productId &&
    a.notes.trim() === b.notes.trim() &&
    a.optionIds.length === b.optionIds.length &&
    [...a.optionIds].sort().join() === [...b.optionIds].sort().join()
  )
}

function update(state: CartState, tableId: string, fn: (cart: TableCart) => TableCart | null) {
  const current = state.carts[tableId] ?? emptyCart()
  if (current.unconfirmed) return state // travado até confirmar o envio
  const next = fn(current)
  const carts = { ...state.carts }
  // qualquer edição apaga o aviso de recusa anterior
  if (next) carts[tableId] = { ...next, error: undefined, updatedAt: Date.now() }
  else delete carts[tableId]
  return { carts }
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      carts: {},

      addLine: (tableId, line) =>
        set((state) =>
          update(state, tableId, (cart) => {
            const existing = cart.items.find((l) => sameLine(line, l))
            const items = existing
              ? cart.items.map((l) => (l === existing ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) } : l))
              : [...cart.items, { ...line, lineId: crypto.randomUUID() }]
            return { ...cart, items }
          })
        ),

      setQuantity: (tableId, lineId, quantity) =>
        set((state) =>
          update(state, tableId, (cart) => ({
            ...cart,
            items:
              quantity <= 0
                ? cart.items.filter((l) => l.lineId !== lineId)
                : cart.items.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.min(99, quantity) } : l)),
          }))
        ),

      removeLine: (tableId, lineId) =>
        set((state) => update(state, tableId, (cart) => ({ ...cart, items: cart.items.filter((l) => l.lineId !== lineId) }))),

      setNote: (tableId, note) => set((state) => update(state, tableId, (cart) => ({ ...cart, note }))),

      markUnconfirmed: (tableId, unconfirmed, meta) =>
        set((state) => {
          const cart = state.carts[tableId]
          if (!cart) return state
          const next = { ...cart, ...meta, unconfirmed }
          if (unconfirmed || !meta?.error) delete next.error
          if (meta?.error) next.error = meta.error
          return { carts: { ...state.carts, [tableId]: next } }
        }),

      // pedido confirmado pelo servidor: descarta e gera chave nova no próximo
      clear: (tableId) =>
        set((state) => {
          const carts = { ...state.carts }
          delete carts[tableId]
          return { carts }
        }),
    }),
    {
      name: "cacau-carrinhos",
      storage: createJSONStorage(() => localStorage),
      // reidratado manualmente após montar, para não divergir do HTML do servidor
      skipHydration: true,
      // carrinhos esquecidos há mais de 12 h são descartados
      partialize: (state) => ({
        carts: Object.fromEntries(
          Object.entries(state.carts).filter(([, c]) => c.unconfirmed || Date.now() - c.updatedAt < 12 * 60 * 60 * 1000)
        ),
      }),
    }
  )
)

export function cartTotals(items: CartLine[], serviceFeePercent: number) {
  const subtotal = Math.round(items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) * 100) / 100
  const service = Math.round(subtotal * serviceFeePercent) / 100
  return { subtotal, service, total: Math.round((subtotal + service) * 100) / 100, count: items.reduce((n, l) => n + l.quantity, 0) }
}
