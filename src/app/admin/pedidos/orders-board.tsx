"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ClipboardList, User } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { NativeSelect } from "@/components/forms/native-select"
import { LiveIndicator } from "@/features/tables/components/live-floor"
import { OrderDetailSheet } from "@/features/orders/components/order-detail-sheet"
import { ORDER_STATUS } from "@/features/orders/status"
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh"
import { useNow } from "@/hooks/use-now"
import { firstName, formatCurrency, formatDuration, formatTime, tableLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MenuData } from "@/services/menu"
import type { OrderPeriod, OrderRow } from "@/services/orders"
import type { OrderStatus } from "@/types/domain"

const COLUMNS: { status: OrderStatus; title: string; accent: string }[] = [
  { status: "novo", title: "Novos", accent: "border-t-status-waiting" },
  { status: "em_preparo", title: "Em preparo", accent: "border-t-status-preparing" },
  { status: "pronto", title: "Prontos", accent: "border-t-status-ready" },
  { status: "entregue", title: "Entregues", accent: "border-t-status-occupied" },
  { status: "finalizado", title: "Finalizados", accent: "border-t-status-closed" },
]

const PERIOD_LABELS: Record<OrderPeriod, string> = { ativos: "Só em andamento", "2h": "Últimas 2 horas", hoje: "Hoje" }

/** Pedido parado há muito tempo na cozinha */
const LATE_MINUTES = 25

export function OrdersBoard({
  restaurantId,
  orders,
  menu,
  period,
}: {
  restaurantId: string
  orders: OrderRow[]
  menu: MenuData
  period: OrderPeriod
}) {
  const live = useRealtimeRefresh(`pedidos:${restaurantId}`, [
    { table: "pedidos", filter: `restaurante_id=eq.${restaurantId}` },
    { table: "itens_pedido", filter: `restaurante_id=eq.${restaurantId}` },
  ], { pollMs: 15_000 })
  const now = useNow(30_000)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mesa, setMesa] = useState("")
  const [garcom, setGarcom] = useState("")
  const [showCanceled, setShowCanceled] = useState(false)

  const tables = useMemo(
    () => [...new Map(orders.filter((o) => o.mesa).map((o) => [o.mesa_id, o.mesa!.numero])).entries()].sort((a, b) => a[1] - b[1]),
    [orders]
  )
  const waiters = useMemo(
    () => [...new Map(orders.filter((o) => o.garcom_id && o.garcom).map((o) => [o.garcom_id!, o.garcom!.nome])).entries()],
    [orders]
  )

  const filtered = orders.filter((o) => (!mesa || o.mesa_id === mesa) && (!garcom || o.garcom_id === garcom))
  const canceled = filtered.filter((o) => o.status === "cancelado" || o.status === "devolvido")
  const columns = showCanceled ? [...COLUMNS, { status: "cancelado" as OrderStatus, title: "Cancelados", accent: "border-t-destructive" }] : COLUMNS
  const selected = orders.find((o) => o.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-[110rem]">
      <PageHeader title="Pedidos" description="Todos os pedidos do salão, atualizados em tempo real." actions={<LiveIndicator state={live} />} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Período
          <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Período">
            {(Object.keys(PERIOD_LABELS) as OrderPeriod[]).map((p) => (
              <Link
                key={p}
                role="tab"
                aria-selected={period === p}
                href={`/admin/pedidos?periodo=${p}`}
                className={cn(
                  "flex h-10 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap",
                  period === p ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
        </label>
        <label className="grid min-w-36 gap-1 text-sm font-semibold">
          Mesa
          <NativeSelect value={mesa} onChange={(e) => setMesa(e.target.value)} className="h-12">
            <option value="">Todas</option>
            {tables.map(([id, numero]) => (
              <option key={id} value={id}>
                {tableLabel(numero)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid min-w-44 gap-1 text-sm font-semibold">
          Garçom
          <NativeSelect value={garcom} onChange={(e) => setGarcom(e.target.value)} className="h-12">
            <option value="">Todos</option>
            {waiters.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </NativeSelect>
        </label>
        <button
          type="button"
          aria-pressed={showCanceled}
          onClick={() => setShowCanceled((v) => !v)}
          className={cn(
            "h-12 rounded-lg border-2 px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            showCanceled ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card"
          )}
        >
          Cancelados ({canceled.length})
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-12 text-center">
          <ClipboardList className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-lg font-semibold">Não há pedidos no momento.</p>
          <p className="text-muted-foreground">Os pedidos lançados pelos garçons aparecem aqui na hora.</p>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
          <div className="grid min-w-[64rem] auto-cols-fr grid-flow-col gap-3">
            {columns.map((col) => {
              const list = filtered.filter((o) =>
                col.status === "cancelado" ? o.status === "cancelado" || o.status === "devolvido" : o.status === col.status
              )
              // em andamento: o mais antigo primeiro (fila); concluídos: o mais recente primeiro
              if (["novo", "em_preparo", "pronto"].includes(col.status)) list.reverse()
              return (
                <section key={col.status} aria-labelledby={`col-${col.status}`} className={cn("flex min-h-64 flex-col rounded-2xl border border-t-4 bg-muted/40", col.accent)}>
                  <header className="flex items-center justify-between px-3 py-3">
                    <h2 id={`col-${col.status}`} className="font-extrabold tracking-wide uppercase">
                      {col.title}
                    </h2>
                    <span className="rounded-full bg-card px-2.5 py-0.5 text-sm font-bold tabular-nums">{list.length}</span>
                  </header>
                  <ul className="grid content-start gap-2 px-2 pb-2">
                    {list.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum pedido.</li>}
                    {list.map((o) => (
                      <li key={o.id}>
                        <OrderCard order={o} now={now} onOpen={() => setSelectedId(o.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      )}

      <OrderDetailSheet order={selected} menu={menu} onClose={() => setSelectedId(null)} />
    </div>
  )
}

function OrderCard({ order, now, onOpen }: { order: OrderRow; now: Date; onOpen: () => void }) {
  const items = order.itens_pedido.filter((i) => !i.cancelado)
  const since = order.enviado_em ?? order.criado_em
  const inKitchen = order.status === "novo" || order.status === "em_preparo"
  const late = inKitchen && now.getTime() - new Date(since).getTime() > LATE_MINUTES * 60_000
  const s = ORDER_STATUS[order.status]

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Pedido ${order.numero}, ${order.mesa ? tableLabel(order.mesa.numero) : ""}, ${s.label}${late ? ", atrasado" : ""}`}
      className={cn(
        "grid w-full gap-2 rounded-xl border bg-card p-3 text-left shadow-xs transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
        late && "border-destructive ring-1 ring-destructive/40"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <div>
          <p className="text-lg leading-tight font-extrabold whitespace-nowrap">{order.mesa ? tableLabel(order.mesa.numero) : "—"}</p>
          <p className="text-xs whitespace-nowrap text-muted-foreground">
            #{order.numero} · {formatTime(since)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap tabular-nums",
            late ? "bg-destructive text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {late && <AlertTriangle className="mr-1 inline size-3" aria-hidden />}
          {formatDuration(since, inKitchen ? now : (order.pronto_em ?? order.entregue_em ?? order.finalizado_em ?? now))}
        </span>
      </div>
      <ul className="grid gap-0.5 text-sm">
        {items.slice(0, 4).map((i) => (
          <li key={i.id} className="truncate">
            <strong>{i.quantidade}x</strong> {i.produto_nome}
          </li>
        ))}
        {items.length > 4 && <li className="text-xs text-muted-foreground">+ {items.length - 4} itens</li>}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
        <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
          <User className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{order.garcom ? firstName(order.garcom.nome) : "—"}</span>
        </span>
        <span className="font-bold tabular-nums">{formatCurrency(order.subtotal)}</span>
      </div>
    </button>
  )
}
