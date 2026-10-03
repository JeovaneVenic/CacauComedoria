"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Ban, BellRing, ChefHat, CircleCheckBig, Clock, Loader2, LogOut, RotateCcw, User, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { LogoMark } from "@/components/brand/logo"
import { ReasonDialog } from "@/components/feedback/reason-dialog"
import { LiveIndicator } from "@/features/tables/components/live-floor"
import { updateOrderStatus } from "@/features/orders/api"
import { playKitchenAlarm } from "@/lib/sounds"
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh"
import { useNow } from "@/hooks/use-now"
import { useStoredFlag } from "@/hooks/use-stored-flag"
import { firstName, formatTime, tableLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { OrderRow } from "@/services/orders"
import type { OrderStatus } from "@/types/domain"

type Column = "novo" | "em_preparo" | "pronto"

const COLUMNS: { status: Column; title: string; icon: typeof ChefHat; accent: string }[] = [
  { status: "novo", title: "Novos", icon: BellRing, accent: "border-t-status-waiting" },
  { status: "em_preparo", title: "Em preparo", icon: ChefHat, accent: "border-t-status-preparing" },
  { status: "pronto", title: "Prontos", icon: CircleCheckBig, accent: "border-t-status-ready" },
]

/** Ação principal de cada coluna */
const PRIMARY: Record<Column, { to: OrderStatus; label: string; className: string }> = {
  novo: { to: "em_preparo", label: "Iniciar preparo", className: "bg-status-preparing text-background hover:bg-status-preparing/90" },
  em_preparo: { to: "pronto", label: "Marcar como pronto", className: "bg-status-ready text-background hover:bg-status-ready/90" },
  pronto: { to: "entregue", label: "Finalizar", className: "bg-primary text-primary-foreground hover:bg-primary/90" },
}

const SOUND_KEY = "cacau-cozinha-som"

/** Pedido em "Novos" há mais que isso volta a tocar o alarme */
const REMIND_AFTER_MS = 30_000

interface KitchenDisplayProps {
  restaurantId: string
  restaurantName: string
  userName: string
  canManage: boolean
  orders: OrderRow[]
}

export function KitchenDisplay({ restaurantId, restaurantName, userName, canManage, orders }: KitchenDisplayProps) {
  const router = useRouter()
  const live = useRealtimeRefresh(
    `cozinha:${restaurantId}`,
    [
      { table: "pedidos", filter: `restaurante_id=eq.${restaurantId}` },
      { table: "itens_pedido", filter: `restaurante_id=eq.${restaurantId}` },
    ],
    { delayMs: 150, pollMs: 10_000 }
  )
  const now = useNow(15_000)
  const [sound, setSound] = useStoredFlag(SOUND_KEY)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<OrderRow | null>(null)

  // Mudança otimista: o cartão troca de coluna na hora; o servidor confirma em seguida
  const [optimistic, setOptimistic] = useState<Record<string, OrderStatus>>({})
  const [prevOrders, setPrevOrders] = useState(orders)
  if (prevOrders !== orders) {
    setPrevOrders(orders)
    setOptimistic({})
  }

  // Aviso de pedido novo (toast + bipe opcional)
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const novos = orders.filter((o) => o.status === "novo")
    if (seen.current === null) {
      seen.current = new Set(novos.map((o) => o.id))
      return
    }
    const fresh = novos.filter((o) => !seen.current!.has(o.id))
    fresh.forEach((o) => {
      seen.current!.add(o.id)
      toast.info(`Novo pedido recebido · ${o.mesa ? tableLabel(o.mesa.numero) : ""}`, { description: `Pedido #${o.numero}` })
    })
    if (fresh.length && sound) playKitchenAlarm()
  }, [orders, sound])

  // Lembrete: enquanto houver pedido esperando em "Novos", toca de novo a cada 30 s
  const waiting = orders.some((o) => o.status === "novo" && !optimistic[o.id])
  useEffect(() => {
    if (!sound || !waiting) return
    const id = setInterval(() => {
      const oldest = orders
        .filter((o) => o.status === "novo" && !optimistic[o.id])
        .some((o) => Date.now() - new Date(o.enviado_em ?? o.criado_em).getTime() > REMIND_AFTER_MS)
      if (oldest) playKitchenAlarm(2)
    }, REMIND_AFTER_MS)
    return () => clearInterval(id)
  }, [sound, waiting, orders, optimistic])

  function toggleSound() {
    const next = !sound
    setSound(next)
    if (next) playKitchenAlarm() // o primeiro toque libera o áudio no navegador e serve de teste
  }

  async function move(order: OrderRow, to: OrderStatus) {
    setBusyId(order.id)
    setOptimistic((m) => ({ ...m, [order.id]: to }))
    const result = await updateOrderStatus(order.id, to)
    setBusyId(null)
    if (!result.ok) {
      setOptimistic((m) => {
        const next = { ...m }
        delete next[order.id]
        return next
      })
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  async function cancel(reason: string) {
    if (!cancelling) return false
    const result = await updateOrderStatus(cancelling.id, "cancelado", reason)
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    toast.success(`Pedido #${cancelling.numero} cancelado.`)
    setCancelling(null)
    router.refresh()
    return true
  }

  const statusOf = (o: OrderRow) => optimistic[o.id] ?? o.status

  return (
    <div className="dark flex h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
        {canManage && (
          <Link href="/admin" className="inline-flex h-11 items-center gap-1.5 rounded-lg pr-2 font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" aria-hidden /> Painel
          </Link>
        )}
        <div className="flex items-center gap-2">
          <LogoMark className="size-9" />
          <h1 className="text-xl font-extrabold tracking-tight">Cozinha</h1>
          <span className="hidden text-muted-foreground sm:inline">· {restaurantName}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-2xl font-bold tabular-nums md:inline" aria-label="Hora atual">
            {formatTime(now)}
          </span>
          <LiveIndicator state={live} />
          <Button
            variant="outline"
            className="h-11"
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={sound ? "Desligar som de novo pedido" : "Ligar som de novo pedido"}
          >
            {sound ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
            <span className="hidden sm:inline">{sound ? "Som ligado" : "Som desligado"}</span>
          </Button>
          <form action="/auth/sair" method="post">
            <Button type="submit" variant="ghost" className="h-11" aria-label={`Sair (${userName})`}>
              <LogOut className="size-5" aria-hidden />
              <span className="hidden lg:inline">{firstName(userName)}</span>
            </Button>
          </form>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-3 md:overflow-hidden md:p-4">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => statusOf(o) === col.status)
          return (
            <section key={col.status} aria-labelledby={`k-${col.status}`} className={cn("flex min-h-0 flex-col rounded-2xl border border-t-4 bg-card/40", col.accent)}>
              <header className="flex items-center justify-between px-4 py-3">
                <h2 id={`k-${col.status}`} className="inline-flex items-center gap-2 text-xl font-extrabold tracking-wide uppercase">
                  <col.icon className="size-6" aria-hidden /> {col.title}
                </h2>
                <span className="rounded-full bg-muted px-3 py-0.5 text-lg font-bold tabular-nums">{list.length}</span>
              </header>
              <ul className="grid min-h-0 content-start gap-3 overflow-y-auto px-3 pb-3">
                {list.length === 0 && (
                  <li className="px-2 py-10 text-center text-muted-foreground">
                    {col.status === "novo" ? "Não há pedidos no momento." : "Nenhum pedido aqui."}
                  </li>
                )}
                {list.map((o) => (
                  <li key={o.id}>
                    <TicketCard
                      order={o}
                      column={col.status}
                      now={now}
                      busy={busyId === o.id}
                      canManage={canManage}
                      onMove={(to) => move(o, to)}
                      onCancel={() => setCancelling(o)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </main>

      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={`Tem certeza que deseja cancelar o pedido #${cancelling?.numero ?? ""}?`}
        description="O garçom e a gerência verão o pedido como cancelado."
        onConfirm={cancel}
      />
    </div>
  )
}

function TicketCard({
  order,
  column,
  now,
  busy,
  canManage,
  onMove,
  onCancel,
}: {
  order: OrderRow
  column: Column
  now: Date
  busy: boolean
  canManage: boolean
  onMove: (to: OrderStatus) => void
  onCancel: () => void
}) {
  // cronômetro desde que o pedido chegou à cozinha
  const since = order.enviado_em ?? order.criado_em
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60000))
  const level = column === "pronto" ? "ok" : minutes >= 20 ? "late" : minutes >= 10 ? "warn" : "ok"
  const primary = PRIMARY[column]
  const back: { to: OrderStatus; label: string } | null =
    column === "em_preparo" ? { to: "novo", label: "Voltar" } : column === "pronto" ? { to: "em_preparo", label: "Reabrir" } : null

  return (
    <article
      aria-label={`Pedido ${order.numero}, ${order.mesa ? tableLabel(order.mesa.numero) : ""}, há ${minutes} minutos`}
      className={cn(
        "grid gap-3 rounded-2xl border-2 bg-card p-4 shadow-sm",
        level === "late" && "border-destructive",
        level === "warn" && "border-status-waiting"
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-3xl leading-none font-extrabold tracking-tight">{order.mesa ? tableLabel(order.mesa.numero) : "—"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedido #{order.numero} · {formatTime(since)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-lg font-extrabold tabular-nums",
            level === "late" ? "bg-destructive text-background" : level === "warn" ? "bg-status-waiting text-background" : "bg-muted"
          )}
        >
          <Clock className="size-4" aria-hidden />
          {minutes} min
        </span>
      </header>

      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <User className="size-4" aria-hidden /> Garçom: {order.garcom?.nome ?? "—"}
      </p>

      <ul className="grid gap-2 border-y py-3">
        {order.itens_pedido.map((i) => (
          <li key={i.id} className={cn(i.cancelado && "opacity-60")}>
            <p className={cn("text-xl leading-snug font-bold", i.cancelado && "line-through")}>
              <span className="mr-1 inline-block min-w-8 rounded-md bg-primary/15 px-1.5 text-center text-primary">{i.quantidade}x</span>
              {i.produto_nome}
            </p>
            {i.itens_pedido_opcoes.length > 0 && (
              <p className="ml-10 text-base font-semibold text-status-preparing">{i.itens_pedido_opcoes.map((m) => m.opcao_nome).join(" · ")}</p>
            )}
            {i.observacao && (
              <p className="mt-1 ml-10 rounded-md bg-status-preparing/20 px-2 py-1 text-base font-bold text-status-preparing">⚠ {i.observacao}</p>
            )}
            {i.cancelado && <p className="ml-10 text-sm font-extrabold text-destructive uppercase">Cancelado — não preparar</p>}
          </li>
        ))}
      </ul>

      {order.observacao && (
        <p className="rounded-lg bg-status-preparing/20 px-3 py-2 text-base font-bold text-status-preparing">
          Observação: &quot;{order.observacao}&quot;
        </p>
      )}

      <Button onClick={() => onMove(primary.to)} disabled={busy} className={cn("h-16 text-lg font-extrabold tracking-wide uppercase", primary.className)}>
        {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {primary.label}
      </Button>
      {(back || canManage) && (
        <div className="flex gap-2">
          {back && (
            <Button variant="outline" className="h-11 flex-1" disabled={busy} onClick={() => onMove(back.to)}>
              <RotateCcw className="size-4" aria-hidden /> {back.label}
            </Button>
          )}
          {canManage && (
            <Button variant="ghost" className="h-11 flex-1 text-destructive" disabled={busy} onClick={onCancel}>
              <Ban className="size-4" aria-hidden /> Cancelar
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
