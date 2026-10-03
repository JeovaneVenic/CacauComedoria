"use client"

import { useState } from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import dynamic from "next/dynamic"
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh"
import { ORDER_STATUS } from "@/features/orders/status"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DashboardData } from "@/services/dashboard"
import type { OrderStatus } from "@/types/domain"

type Period = "hoje" | "semana" | "mes"

const PERIODS: { id: Period; label: string; previous: keyof DashboardData["periodos"]; vs: string }[] = [
  { id: "hoje", label: "Hoje", previous: "ontem", vs: "ontem" },
  { id: "semana", label: "Semana", previous: "semana_anterior", vs: "a semana passada" },
  { id: "mes", label: "Mês", previous: "mes_anterior", vs: "o mesmo período do mês passado" },
]

// gráfico carregado depois dos números (a biblioteca Recharts pesa ~90 KB comprimida)
const RevenueChart = dynamic(() => import("./revenue-chart").then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <div className="h-[22rem] animate-pulse rounded-2xl border bg-card" aria-hidden />,
})

const STATUS_ROW: OrderStatus[] = ["novo", "em_preparo", "pronto", "entregue", "finalizado", "cancelado"]

export function DashboardMetrics({ restaurantId, data }: { restaurantId: string; data: DashboardData }) {
  const [period, setPeriod] = useState<Period>("hoje")
  useRealtimeRefresh(
    `dashboard:${restaurantId}`,
    ["pagamentos", "pedidos", "despesas"].map((table) => ({ table, filter: `restaurante_id=eq.${restaurantId}` })),
    { delayMs: 800, pollMs: 30_000 }
  )

  const p = PERIODS.find((x) => x.id === period)!
  const now = data.periodos[period]
  const before = data.periodos[p.previous]
  const status = data.pedidos_status

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Período" className="flex gap-1 rounded-xl bg-muted p-1">
          {PERIODS.map((x) => (
            <button
              key={x.id}
              role="tab"
              type="button"
              aria-selected={period === x.id}
              onClick={() => setPeriod(x.id)}
              className={cn(
                "h-10 rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                period === x.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Comparação com {p.vs}</p>
      </div>

      <section aria-label="Indicadores financeiros" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Faturamento" value={formatCurrency(now.faturamento)} now={now.faturamento} before={before.faturamento} vs={p.vs} highlight />
        <Kpi label="Pedidos" value={String(now.pedidos)} now={now.pedidos} before={before.pedidos} vs={p.vs} />
        <Kpi label="Ticket médio" value={formatCurrency(now.ticket_medio)} now={now.ticket_medio} before={before.ticket_medio} vs={p.vs} />
        <Kpi label="Despesas" value={formatCurrency(now.despesas)} now={now.despesas} before={before.despesas} vs={p.vs} inverse />
        <Kpi label="Lucro estimado" value={formatCurrency(now.lucro)} now={now.lucro} before={before.lucro} vs={p.vs} negative={now.lucro < 0} />
        <Kpi
          label="Receita estimada"
          value={formatCurrency(now.faturamento + (period === "hoje" ? data.em_aberto : 0))}
          hint={period === "hoje" ? `inclui ${formatCurrency(data.em_aberto)} em aberto nas mesas` : "faturamento do período"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <RevenueChart serie={data.serie_14_dias} />
        <section aria-labelledby="pedidos-agora" className="rounded-2xl border bg-card p-4">
          <h2 id="pedidos-agora" className="font-bold">
            Pedidos de hoje
          </h2>
          <p className="text-sm text-muted-foreground">Inclui os que seguem em andamento.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {STATUS_ROW.map((s) => {
              const meta = ORDER_STATUS[s]
              const n = s === "cancelado" ? (status.cancelado ?? 0) + (status.devolvido ?? 0) : (status[s] ?? 0)
              return (
                <li key={s} className="flex items-center gap-2 rounded-xl border p-3">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.badge)}>
                    <meta.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl leading-none font-extrabold tabular-nums">{n}</span>
                    <span className="text-xs text-muted-foreground">{s === "cancelado" ? "Cancelados" : meta.label}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  now,
  before,
  vs,
  hint,
  inverse,
  highlight,
  negative,
}: {
  label: string
  value: string
  now?: number
  before?: number
  vs?: string
  hint?: string
  /** para despesas, subir é ruim */
  inverse?: boolean
  highlight?: boolean
  negative?: boolean
}) {
  let delta: { pct: number; good: boolean } | null = null
  if (now !== undefined && before !== undefined && before !== 0) {
    const pct = Math.round(((now - before) / Math.abs(before)) * 100)
    delta = { pct, good: inverse ? pct <= 0 : pct >= 0 }
  }
  const Icon = !delta || delta.pct === 0 ? Minus : delta.pct > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className={cn("grid content-start gap-1 rounded-2xl border bg-card p-4", highlight && "border-primary/40")}>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-extrabold tracking-tight tabular-nums", negative && "text-destructive")}>{value}</span>
      {delta ? (
        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", delta.pct === 0 ? "text-muted-foreground" : delta.good ? "text-status-free" : "text-destructive")}>
          <Icon className="size-3.5" aria-hidden />
          {delta.pct > 0 ? "+" : ""}
          {delta.pct}% <span className="font-normal text-muted-foreground">vs {vs}</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{hint ?? "sem base de comparação"}</span>
      )}
    </div>
  )
}
