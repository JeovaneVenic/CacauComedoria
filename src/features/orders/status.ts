import { Ban, BellRing, ChefHat, CircleCheckBig, Clock, HandPlatter, RotateCcw, Send, Undo2, type LucideIcon } from "lucide-react"
import type { OrderStatus } from "@/types/domain"

export const ORDER_STATUS: Record<OrderStatus, { label: string; icon: LucideIcon; badge: string }> = {
  aguardando_envio: { label: "Aguardando envio", icon: Clock, badge: "bg-muted text-muted-foreground" },
  novo: { label: "Novo", icon: Send, badge: "bg-status-waiting-soft text-status-waiting" },
  em_preparo: { label: "Em preparo", icon: ChefHat, badge: "bg-status-preparing-soft text-status-preparing" },
  pronto: { label: "Pronto", icon: BellRing, badge: "bg-status-ready text-white dark:text-background" },
  entregue: { label: "Entregue", icon: HandPlatter, badge: "bg-status-occupied-soft text-status-occupied" },
  finalizado: { label: "Finalizado", icon: CircleCheckBig, badge: "bg-status-closed-soft text-status-closed" },
  cancelado: { label: "Cancelado", icon: Ban, badge: "bg-destructive/10 text-destructive" },
  devolvido: { label: "Devolvido", icon: Undo2, badge: "bg-destructive/10 text-destructive" },
}

export interface OrderAction {
  to: OrderStatus
  label: string
  icon: LucideIcon
  primary?: boolean
}

/**
 * Próximos passos possíveis a partir de cada status (espelha privado.transicao_permitida).
 * Cancelar/devolver ficam separados porque pedem confirmação e motivo.
 */
export const ORDER_NEXT: Partial<Record<OrderStatus, OrderAction[]>> = {
  novo: [{ to: "em_preparo", label: "Iniciar preparo", icon: ChefHat, primary: true }],
  em_preparo: [
    { to: "pronto", label: "Marcar como pronto", icon: BellRing, primary: true },
    { to: "novo", label: "Voltar para novos", icon: RotateCcw },
  ],
  pronto: [
    { to: "entregue", label: "Marcar como entregue", icon: HandPlatter, primary: true },
    { to: "em_preparo", label: "Voltar para preparo", icon: RotateCcw },
  ],
  entregue: [{ to: "finalizado", label: "Finalizar", icon: CircleCheckBig, primary: true }],
}

export const CANCELABLE: OrderStatus[] = ["aguardando_envio", "novo", "em_preparo", "pronto"]
export const RETURNABLE: OrderStatus[] = ["entregue"]
/** Pedidos que ainda aceitam mudança de itens */
export const EDITABLE: OrderStatus[] = ["aguardando_envio", "novo", "em_preparo", "pronto", "entregue"]
