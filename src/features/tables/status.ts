import {
  BellRing,
  ChefHat,
  CircleCheckBig,
  ClipboardList,
  Lock,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { TableStatus } from "@/types/domain"

interface StatusStyle {
  label: string
  icon: LucideIcon
  /** classes do selo (texto + fundo suave) */
  badge: string
  /** classes do cartão da mesa */
  card: string
  /** cor sólida para pontos/legendas */
  dot: string
}

// Cada estado tem ícone + texto: a cor nunca é o único indicador.
export const TABLE_STATUS: Record<TableStatus, StatusStyle> = {
  livre: {
    label: "Livre",
    icon: CircleCheckBig,
    badge: "bg-status-free-soft text-status-free",
    card: "border-border bg-card",
    dot: "bg-status-free",
  },
  ocupada: {
    label: "Ocupada",
    icon: Users,
    badge: "bg-status-occupied-soft text-status-occupied",
    card: "border-status-occupied/45 bg-card",
    dot: "bg-status-occupied",
  },
  aguardando_pedido: {
    label: "Aguardando pedido",
    icon: ClipboardList,
    badge: "bg-status-waiting-soft text-status-waiting",
    card: "border-status-waiting/55 bg-card",
    dot: "bg-status-waiting",
  },
  em_preparo: {
    label: "Em preparo",
    icon: ChefHat,
    badge: "bg-status-preparing-soft text-status-preparing",
    card: "border-status-preparing/55 bg-card",
    dot: "bg-status-preparing",
  },
  pedido_pronto: {
    label: "Pedido pronto",
    icon: BellRing,
    badge: "bg-status-ready text-white dark:text-background",
    card: "border-status-ready bg-status-ready-soft ring-2 ring-status-ready/40",
    dot: "bg-status-ready",
  },
  aguardando_pagamento: {
    label: "Aguardando pagamento",
    icon: Receipt,
    badge: "bg-status-payment-soft text-status-payment",
    card: "border-status-payment/55 bg-card",
    dot: "bg-status-payment",
  },
  finalizada: {
    label: "Finalizada",
    icon: Lock,
    badge: "bg-status-closed-soft text-status-closed",
    card: "border-border bg-muted",
    dot: "bg-status-closed",
  },
}

export const TABLE_STATUS_ORDER: TableStatus[] = [
  "livre",
  "ocupada",
  "aguardando_pedido",
  "em_preparo",
  "pedido_pronto",
  "aguardando_pagamento",
  "finalizada",
]
