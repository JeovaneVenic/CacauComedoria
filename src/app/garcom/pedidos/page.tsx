import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { requireRoleWith } from "@/lib/auth"
import { FLOOR_ROLES } from "@/lib/roles"
import { formatCurrency, formatDuration, tableLabel } from "@/lib/format"
import { getWaiterOrders } from "@/services/orders"
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge"
import { DeliverButton } from "@/features/orders/components/deliver-button"
import { LiveRefresh } from "../live-refresh"
import type { OrderStatus } from "@/types/domain"

export const metadata: Metadata = { title: "Meus pedidos" }

// o que precisa de ação aparece primeiro
const PRIORITY: Partial<Record<OrderStatus, number>> = { pronto: 0, em_preparo: 1, novo: 2, entregue: 3 }

export default async function WaiterOrdersPage() {
  const { profile, restaurant, data: waiterOrders } = await requireRoleWith(FLOOR_ROLES, getWaiterOrders)
  const orders = waiterOrders
    .filter((o) => o.status in PRIORITY)
    .sort((a, b) => (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9) || a.criado_em.localeCompare(b.criado_em))
  const ready = orders.filter((o) => o.status === "pronto").length

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <LiveRefresh channel={`garcom-pedidos:${profile.id}`} restaurantId={restaurant.id} tables={["pedidos", "itens_pedido"]} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Meus pedidos</h1>
        <p className="text-muted-foreground">
          {ready > 0 ? `${ready} ${ready === 1 ? "pedido pronto" : "pedidos prontos"} para levar à mesa.` : "Pedidos das suas mesas abertas."}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
          <ClipboardList className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">Não há pedidos no momento.</p>
          <Link href="/garcom" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Ir para as mesas
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {orders.map((o) => {
            const items = o.itens_pedido.filter((i) => !i.cancelado)
            return (
              <li key={o.id} className={o.status === "pronto" ? "rounded-2xl border-2 border-status-ready bg-status-ready-soft/50 p-4" : "rounded-2xl border bg-card p-4"}>
                <Link href={`/garcom/mesa/${o.mesa_id}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="text-xl font-extrabold">{o.mesa ? tableLabel(o.mesa.numero) : "Mesa"}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      #{o.numero} · há {formatDuration(o.enviado_em ?? o.criado_em)}
                    </span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                </Link>
                <p className="mt-2 text-sm">
                  {items.map((i) => `${i.quantidade}x ${i.produto_nome}`).join(" · ")}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{items.reduce((n, i) => n + i.quantidade, 0)} itens</span>
                  <span className="font-bold tabular-nums">{formatCurrency(o.subtotal)}</span>
                </div>
                {o.status === "pronto" && <DeliverButton orderId={o.id} orderNumber={o.numero} className="mt-3 w-full" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
