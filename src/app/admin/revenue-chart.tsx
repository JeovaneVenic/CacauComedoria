"use client"

// Carregado sob demanda (next/dynamic): a biblioteca de gráficos não entra no carregamento inicial do painel.
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/format"
import type { DashboardData } from "@/services/dashboard"

// validadas para daltonismo e contraste (dataviz/validate_palette)
const SERIES = { faturamento: "#b5461c", despesas: "#3b6fb6" }

const compactBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 })
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })

export function RevenueChart({ serie }: { serie: DashboardData["serie_14_dias"] }) {
  const rows = serie.map((d) => ({ ...d, label: dayFmt.format(new Date(d.dia)), full: weekdayFmt.format(new Date(d.dia)) }))
  const total = rows.reduce((s, r) => s + r.faturamento, 0)

  return (
    <section aria-labelledby="grafico-faturamento" className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="grafico-faturamento" className="font-bold">
          Faturamento e despesas nos últimos 14 dias
        </h2>
        <span className="text-sm text-muted-foreground">Faturamento no período: {formatCurrency(total)}</span>
      </div>
      <div className="mt-3 h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => compactBRL.format(v).replace(/ /g, " ")}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as (typeof rows)[number]
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                    <p className="font-semibold capitalize">{row.full}</p>
                    <p className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: SERIES.faturamento }} /> Faturamento: <strong>{formatCurrency(row.faturamento)}</strong>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: SERIES.despesas }} /> Despesas: <strong>{formatCurrency(row.despesas)}</strong>
                    </p>
                  </div>
                )
              }}
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={28}
              iconType="square"
              formatter={(v: string) => <span className="text-sm text-foreground">{v === "faturamento" ? "Faturamento" : "Despesas"}</span>}
            />
            <Bar dataKey="faturamento" fill={SERIES.faturamento} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="despesas" fill={SERIES.despesas} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* versão em tabela para leitores de tela */}
      <table className="sr-only">
        <caption>Faturamento e despesas por dia</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Faturamento</th>
            <th>Despesas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dia}>
              <td>{r.full}</td>
              <td>{formatCurrency(r.faturamento)}</td>
              <td>{formatCurrency(r.despesas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

