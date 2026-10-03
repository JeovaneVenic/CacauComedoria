import { AlertTriangle, CircleCheck, CircleSlash } from "lucide-react"

const qty = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 })

export function formatQty(n: number, unidade?: string) {
  return unidade ? `${qty.format(n)} ${unidade}` : qty.format(n)
}

export function toQtyInput(n: number) {
  return qty.format(n).replace(/\./g, "")
}

export type StockLevel = "sem" | "baixo" | "ok"

export function stockLevel(quantidade: number, minima: number): StockLevel {
  if (quantidade <= 0) return "sem"
  if (quantidade < minima) return "baixo"
  return "ok"
}

export const STOCK_LEVEL = {
  sem: { label: "Sem estoque", icon: CircleSlash, badge: "bg-destructive/10 text-destructive" },
  baixo: { label: "Abaixo do mínimo", icon: AlertTriangle, badge: "bg-status-preparing-soft text-status-preparing" },
  ok: { label: "Em dia", icon: CircleCheck, badge: "bg-status-free-soft text-status-free" },
} as const

export const MOVEMENT_LABEL = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Contagem",
  consumo: "Consumo",
} as const
