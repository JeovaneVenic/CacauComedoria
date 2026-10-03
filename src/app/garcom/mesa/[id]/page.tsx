import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, Plus, Receipt, User, Users, UtensilsCrossed } from "lucide-react"
import { DeliverButton } from "@/features/orders/components/deliver-button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { requireRoleWith } from "@/lib/auth"
import { FLOOR_ROLES } from "@/lib/roles"
import { formatCurrency, formatTime, tableLabel } from "@/lib/format"
import { getTableWithSession } from "@/services/tables"
import { getOpenTableOrders } from "@/services/orders"
import { TableStatusBadge } from "@/features/tables/components/table-status-badge"
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge"
import { TableLiveRefresh } from "./table-live-refresh"

export const metadata: Metadata = { title: "Mesa" }

export default async function WaiterTablePage({ params }: PageProps<"/garcom/mesa/[id]">) {
  const { id } = await params
  // mesa, pedidos abertos e permissão em paralelo
  const {
    restaurant,
    data: [table, openOrders],
  } = await requireRoleWith(FLOOR_ROLES, () => Promise.all([getTableWithSession(id), getOpenTableOrders(id)]))
  if (!table) notFound()

  const orders = table.atendimento_id ? openOrders : []
  const active = orders.filter((o) => o.status !== "cancelado" && o.status !== "devolvido")
  const subtotal = active.reduce((sum, o) => sum + Number(o.subtotal), 0)
  const service = Math.round(subtotal * restaurant.taxa_servico_percentual) / 100

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <TableLiveRefresh restaurantId={restaurant.id} tableId={table.id} sessionId={table.atendimento_id} />
      <Link
        href="/garcom"
        className="inline-flex h-11 w-fit items-center gap-2 rounded-lg pr-3 text-base font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-5" aria-hidden /> Mesas
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{tableLabel(table.numero)}</h1>
          <TableStatusBadge status={table.status} size="lg" />
        </div>
        {table.atendimento_id && (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Garçom</dt>
              <User className="size-4" aria-hidden />
              <dd>{table.garcom_nome ?? "—"}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Pessoas</dt>
              <Users className="size-4" aria-hidden />
              <dd>{table.pessoas} pessoas</dd>
            </div>
            {table.aberto_em && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Aberta às</dt>
                <Clock className="size-4" aria-hidden />
                <dd>Aberta às {formatTime(table.aberto_em)}</dd>
              </div>
            )}
          </dl>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Link
          href={`/garcom/mesa/${table.id}/pedido`}
          className={cn(buttonVariants(), "h-16 text-lg font-extrabold tracking-wide uppercase shadow-lg")}
        >
          <Plus className="size-6" aria-hidden /> Novo pedido
        </Link>
        {table.atendimento_id && (
          <Link
            href={`/garcom/mesa/${table.id}/conta`}
            className={cn(buttonVariants({ variant: "outline" }), "h-16 text-lg font-bold")}
          >
            <Receipt className="size-6" aria-hidden /> Conta
          </Link>
        )}
      </div>

      {!table.atendimento_id ? (
        <EmptyState title="Mesa livre" text="Toque em Novo pedido para abrir a mesa e lançar os itens." />
      ) : orders.length === 0 ? (
        <EmptyState title="Não há pedidos nesta mesa." text="Os pedidos enviados para a cozinha aparecem aqui." />
      ) : (
        <section aria-labelledby="pedidos" className="grid gap-3">
          <h2 id="pedidos" className="text-lg font-bold">
            Pedidos
          </h2>
          <ul className="grid gap-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    Pedido #{order.numero}
                    <span className="ml-2 font-normal text-muted-foreground">{formatTime(order.criado_em)}</span>
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <ul className="mt-3 grid gap-2">
                  {order.itens_pedido.map((item) => (
                    <li key={item.id} className={item.cancelado ? "text-muted-foreground line-through" : undefined}>
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold">
                          {item.quantidade}x {item.produto_nome}
                        </span>
                        <span className="tabular-nums">{formatCurrency(item.quantidade * Number(item.preco_unitario))}</span>
                      </div>
                      {(item.itens_pedido_opcoes.length > 0 || item.observacao) && (
                        <p className="text-sm text-muted-foreground">
                          {[...item.itens_pedido_opcoes.map((m) => m.opcao_nome), item.observacao && `“${item.observacao}”`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {order.observacao && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">Observação: {order.observacao}</p>}
                {order.status === "pronto" && <DeliverButton orderId={order.id} orderNumber={order.numero} className="mt-3 w-full" />}
              </li>
            ))}
          </ul>

          <dl className="grid gap-1.5 rounded-2xl border bg-card p-4 text-base">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Serviço ({restaurant.taxa_servico_percentual}%)</dt>
              <dd className="tabular-nums">{formatCurrency(service)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t pt-2 text-lg font-extrabold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(subtotal + service)}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
      <UtensilsCrossed className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
