"use client"

// Desenho dos gráficos dos relatórios. Carregado sob demanda (next/dynamic) para a biblioteca
// de gráficos não entrar no carregamento inicial da tela; títulos, tabelas e CSV ficam na tela principal.
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/format"

// mesmas cores validadas do painel (dataviz/validate_palette)
const SERIES = { faturamento: "#b5461c", despesas: "#3b6fb6" }

const compactBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 })
const intFmt = new Intl.NumberFormat("pt-BR")
const axisTick = { fontSize: 12, fill: "var(--muted-foreground)" }
const moneyTick = (v: number) => compactBRL.format(v).replace(/ /g, " ")

export interface DailyRow {
  key: string
  label: string
  full: string
  faturamento: number
  despesas: number
  pedidos: number
}

export function DailyBars({ rows }: { rows: DailyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart accessibilityLayer={false} data={rows} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={64} tick={axisTick} tickFormatter={moneyTick} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as DailyRow
            return (
              <ChartTip title={row.full}>
                <TipLine color={SERIES.faturamento} label="Faturamento" value={formatCurrency(row.faturamento)} />
                <TipLine color={SERIES.despesas} label="Despesas" value={formatCurrency(row.despesas)} />
                <p className="mt-1 text-muted-foreground">
                  Resultado: <strong className="text-foreground">{formatCurrency(row.faturamento - row.despesas)}</strong> · {intFmt.format(row.pedidos)} pedidos
                </p>
              </ChartTip>
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
  )
}

export interface HourRow {
  hora: number
  pedidos: number
  receita: number
  label: string
}

export function HourBars({ rows, metric }: { rows: HourRow[]; metric: "pedidos" | "receita" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart accessibilityLayer={false} data={rows} barCategoryGap="18%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={metric === "receita" ? 64 : 40}
          tick={axisTick}
          allowDecimals={false}
          tickFormatter={metric === "receita" ? moneyTick : undefined}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as HourRow
            return (
              <ChartTip title={`Das ${row.hora}h às ${row.hora}h59`}>
                <p>
                  <strong>{intFmt.format(row.pedidos)}</strong> pedidos
                </p>
                <p>
                  <strong>{formatCurrency(row.receita)}</strong> em itens
                </p>
              </ChartTip>
            )
          }}
        />
        <Bar dataKey={metric} fill={SERIES.faturamento} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold capitalize">{title}</p>
      {children}
    </div>
  )
}

function TipLine({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="size-2.5 rounded-sm" style={{ background: color }} /> {label}: <strong>{value}</strong>
    </p>
  )
}
