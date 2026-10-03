"use client"

import { useMemo, useState } from "react"
import { Clock, Download, Timer, XCircle } from "lucide-react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { ORDER_STATUS } from "@/features/orders/status"
import { FORMA_LABEL } from "@/schemas/common"
import { downloadCsv, type CsvValue } from "@/lib/csv"
import { formatCurrency } from "@/lib/format"
import type { ResolvedPeriod } from "@/lib/periods"
import { cn } from "@/lib/utils"
import type { ReportData } from "@/services/reports"
import type { OrderStatus } from "@/types/domain"
import { REPORT_TABS, type ReportTab } from "./tabs"

// gráficos carregados depois do conteúdo (a biblioteca Recharts pesa ~90 KB comprimida)
const chartLoading = () => <div className="h-full animate-pulse rounded-xl bg-muted" />
const DailyBars = dynamic(() => import("./report-charts").then((m) => m.DailyBars), { ssr: false, loading: chartLoading })
const HourBars = dynamic(() => import("./report-charts").then((m) => m.HourBars), { ssr: false, loading: chartLoading })

// mesmas cores validadas do painel (dataviz/validate_palette)
const SERIES = { faturamento: "#b5461c", despesas: "#3b6fb6" }
const TYPE_LABEL: Record<string, string> = { fixa: "Fixa", variavel: "Variável", operacional: "Operacional" }

const intFmt = new Intl.NumberFormat("pt-BR")
const pctFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 })
const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
const monthLongFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })


interface Props {
  data: ReportData
  period: ResolvedPeriod
  initialTab: ReportTab
}

export function ReportsView({ data, period, initialTab }: Props) {
  const [tab, setTab] = useState<ReportTab>(initialTab)
  const file = (name: string) => `${name}-${period.inicio}-a-${period.fim}`

  function select(id: ReportTab) {
    setTab(id)
    const url = new URL(window.location.href)
    url.searchParams.set("aba", id)
    window.history.replaceState(null, "", url)
  }

  return (
    <div className="grid gap-6">
      <div role="tablist" aria-label="Relatório" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`aba-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="painel-relatorio"
            onClick={() => select(t.id)}
            className={cn(
              "-mb-px h-11 shrink-0 border-b-2 px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="painel-relatorio" role="tabpanel" aria-labelledby={`aba-${tab}`} className="grid gap-6">
        {tab === "vendas" && <SalesTab data={data} file={file} />}
        {tab === "produtos" && <ProductsTab data={data} file={file} />}
        {tab === "equipe" && <TeamTab data={data} file={file} />}
        {tab === "pedidos" && <OrdersTab data={data} file={file} />}
        {tab === "despesas" && <ExpensesTab data={data} file={file} />}
      </div>
    </div>
  )
}

type TabProps = { data: ReportData; file: (name: string) => string }

/* ---------------------------------------------------------------- Vendas */

function SalesTab({ data, file }: TabProps) {
  const r = data.resumo
  const lucro = r.faturamento - r.despesas
  const ticket = r.pedidos ? r.faturamento / r.pedidos : 0
  const porPessoa = r.pessoas ? r.faturamento / r.pessoas : 0
  const singleDay = data.por_dia.length === 1
  const totalFormas = data.formas_pagamento.reduce((s, f) => s + f.valor, 0)

  return (
    <>
      <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Faturamento" value={formatCurrency(r.faturamento)} hint={`${intFmt.format(r.mesas_atendidas)} mesas fechadas`} strong />
        <Tile label="Despesas" value={formatCurrency(r.despesas)} hint={r.faturamento ? `${pctFmt.format(r.despesas / r.faturamento)} do faturamento` : "no período"} />
        <Tile label="Lucro estimado" value={formatCurrency(lucro)} hint={r.faturamento ? `margem de ${pctFmt.format(lucro / r.faturamento)}` : "faturamento − despesas"} negative={lucro < 0} />
        <Tile label="Pedidos" value={intFmt.format(r.pedidos)} hint={`${intFmt.format(r.itens)} itens vendidos`} />
        <Tile label="Ticket médio" value={formatCurrency(ticket)} hint="faturamento ÷ pedidos" />
        <Tile label="Gasto por pessoa" value={formatCurrency(porPessoa)} hint={`${intFmt.format(r.pessoas)} clientes atendidos`} />
      </section>

      {singleDay ? (
        <HourChart data={data} metric="receita" title="Vendas por hora" />
      ) : (
        <DailyChart data={data} file={file} />
      )}

      <Panel
        title="Formas de pagamento"
        description="Quanto entrou por cada meio de pagamento."
        onExport={() =>
          downloadCsv(
            file("formas-pagamento"),
            ["Forma", "Pagamentos", "Valor (R$)", "Participação"],
            data.formas_pagamento.map((f) => [FORMA_LABEL[f.forma] ?? f.forma, f.n, f.valor, totalFormas ? pctFmt.format(f.valor / totalFormas) : ""])
          )
        }
      >
        <RankBars
          empty="Nenhum pagamento no período."
          rows={data.formas_pagamento.map((f) => ({
            key: f.forma,
            label: FORMA_LABEL[f.forma] ?? f.forma,
            value: f.valor,
            display: formatCurrency(f.valor),
            sub: `${intFmt.format(f.n)} pagamentos · ${totalFormas ? pctFmt.format(f.valor / totalFormas) : "0%"}`,
          }))}
        />
      </Panel>
    </>
  )
}

function DailyChart({ data, file }: TabProps) {
  // períodos longos ficam ilegíveis por dia: agrupa por mês acima de ~2 meses
  const monthly = data.por_dia.length > 62
  const rows = useMemo(() => {
    if (!monthly) {
      return data.por_dia.map((d) => ({ ...d, key: d.dia, label: dayFmt.format(new Date(d.dia)), full: weekdayFmt.format(new Date(d.dia)) }))
    }
    const map = new Map<string, { key: string; label: string; full: string; faturamento: number; despesas: number; pedidos: number }>()
    for (const d of data.por_dia) {
      const k = d.dia.slice(0, 7)
      const date = new Date(`${k}-01T12:00:00Z`)
      const row = map.get(k) ?? { key: k, label: monthFmt.format(date), full: monthLongFmt.format(date), faturamento: 0, despesas: 0, pedidos: 0 }
      row.faturamento += d.faturamento
      row.despesas += d.despesas
      row.pedidos += d.pedidos
      map.set(k, row)
    }
    return [...map.values()]
  }, [data.por_dia, monthly])

  return (
    <Panel
      title={monthly ? "Faturamento e despesas por mês" : "Faturamento e despesas por dia"}
      description="Faturamento são os pagamentos recebidos; despesas, os lançamentos do financeiro."
      onExport={() =>
        downloadCsv(
          file(monthly ? "vendas-por-mes" : "vendas-por-dia"),
          [monthly ? "Mês" : "Dia", "Faturamento (R$)", "Despesas (R$)", "Resultado (R$)", "Pedidos"],
          rows.map((r) => [monthly ? r.full : r.key.split("-").reverse().join("/"), r.faturamento, r.despesas, r.faturamento - r.despesas, r.pedidos])
        )
      }
    >
      <div className="h-72" aria-hidden>
        <DailyBars rows={rows} />
      </div>
      <SrTable
        caption="Faturamento e despesas"
        head={[monthly ? "Mês" : "Dia", "Faturamento", "Despesas"]}
        rows={rows.map((r) => [r.full, formatCurrency(r.faturamento), formatCurrency(r.despesas)])}
      />
    </Panel>
  )
}

function HourChart({ data, metric, title }: { data: ReportData; metric: "pedidos" | "receita"; title: string }) {
  // mostra só a faixa de horas com movimento
  const active = data.por_hora.filter((h) => h.pedidos > 0)
  const first = active.length ? active[0].hora : 0
  const last = active.length ? active[active.length - 1].hora : 23
  const rows = data.por_hora.filter((h) => h.hora >= first && h.hora <= last).map((h) => ({ ...h, label: `${h.hora}h` }))
  const peak = rows.reduce((a, b) => (b[metric] > a[metric] ? b : a), rows[0])
  const fmt = (v: number) => (metric === "receita" ? formatCurrency(v) : `${intFmt.format(v)} pedidos`)

  return (
    <Panel
      title={title}
      description={active.length && peak ? `Pico às ${peak.hora}h, com ${fmt(peak[metric])}. Horário de Brasília, pela hora em que o pedido foi feito.` : "Nenhum pedido no período."}
    >
      <div className="h-64" aria-hidden>
        <HourBars rows={rows} metric={metric} />
      </div>
      <SrTable caption={title} head={["Hora", "Pedidos", "Receita"]} rows={rows.map((r) => [`${r.hora}h`, String(r.pedidos), formatCurrency(r.receita)])} />
    </Panel>
  )
}

/* ---------------------------------------------------------------- Produtos */

function ProductsTab({ data, file }: TabProps) {
  const totalCat = data.categorias.reduce((s, c) => s + c.receita, 0)
  const top = data.produtos.slice(0, 10)

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Mais vendidos" description="Os 10 produtos que mais faturaram no período.">
        <RankBars
          empty="Nenhum item vendido no período."
          rows={top.map((p, i) => ({
            key: `${p.nome}-${i}`,
            label: p.nome,
            value: p.receita,
            display: formatCurrency(p.receita),
            sub: `${intFmt.format(p.quantidade)} vendidos · ${p.categoria}`,
          }))}
        />
      </Panel>

      <Panel
        title="Por categoria"
        description="Participação de cada categoria do cardápio."
        onExport={() =>
          downloadCsv(
            file("categorias"),
            ["Categoria", "Itens vendidos", "Receita (R$)", "Participação"],
            data.categorias.map((c) => [c.nome, c.quantidade, c.receita, totalCat ? pctFmt.format(c.receita / totalCat) : ""])
          )
        }
      >
        <RankBars
          empty="Nenhum item vendido no período."
          rows={data.categorias.map((c) => ({
            key: c.nome,
            label: c.nome,
            value: c.receita,
            display: formatCurrency(c.receita),
            sub: `${intFmt.format(c.quantidade)} itens · ${totalCat ? pctFmt.format(c.receita / totalCat) : "0%"}`,
          }))}
        />
      </Panel>

      <Panel
        className="xl:col-span-2"
        title="Todos os produtos vendidos"
        description="Ordenados por receita. Itens cancelados não entram."
        onExport={() =>
          downloadCsv(
            file("produtos"),
            ["Produto", "Categoria", "Quantidade", "Receita (R$)", "Preço médio (R$)"],
            data.produtos.map((p) => [p.nome, p.categoria, p.quantidade, p.receita, p.quantidade ? p.receita / p.quantidade : 0])
          )
        }
      >
        <DataTable
          empty="Nenhum item vendido no período."
          head={["Produto", "Categoria", "Qtd.", "Receita", "Preço médio"]}
          align={["left", "left", "right", "right", "right"]}
          rows={data.produtos.map((p) => [p.nome, p.categoria, intFmt.format(p.quantidade), formatCurrency(p.receita), formatCurrency(p.quantidade ? p.receita / p.quantidade : 0)])}
        />
      </Panel>
    </div>
  )
}

/* ---------------------------------------------------------------- Equipe e mesas */

function TeamTab({ data, file }: TabProps) {
  const mesas = data.mesas.filter((m) => m.atendimentos > 0)
  const ociosas = data.mesas.length - mesas.length

  return (
    <div className="grid gap-6">
      <Panel
        title="Vendas por garçom"
        description="Valor dos pedidos lançados por cada garçom (sem taxa de serviço e descontos)."
        onExport={() =>
          downloadCsv(
            file("garcons"),
            ["Garçom", "Pedidos", "Mesas fechadas", "Vendas (R$)", "Ticket médio (R$)"],
            data.garcons.map((g) => [g.nome, g.pedidos, g.mesas, g.receita, g.ticket_medio])
          )
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <RankBars
            empty="Nenhum pedido no período."
            rows={data.garcons.map((g) => ({ key: g.nome, label: g.nome, value: g.receita, display: formatCurrency(g.receita), sub: `${intFmt.format(g.pedidos)} pedidos` }))}
          />
          <DataTable
            empty="Nenhum pedido no período."
            head={["Garçom", "Pedidos", "Mesas", "Ticket médio"]}
            align={["left", "right", "right", "right"]}
            rows={data.garcons.map((g) => [g.nome, intFmt.format(g.pedidos), intFmt.format(g.mesas), formatCurrency(g.ticket_medio)])}
          />
        </div>
      </Panel>

      <Panel
        title="Desempenho das mesas"
        description={ociosas > 0 ? `${ociosas} ${ociosas === 1 ? "mesa não foi usada" : "mesas não foram usadas"} no período.` : "Atendimentos fechados por mesa."}
        onExport={() =>
          downloadCsv(
            file("mesas"),
            ["Mesa", "Atendimentos", "Pessoas", "Receita (R$)", "Receita por atendimento (R$)", "Permanência média (min)"],
            data.mesas.map((m) => [m.numero, m.atendimentos, m.pessoas, m.receita, m.atendimentos ? m.receita / m.atendimentos : 0, m.permanencia_min])
          )
        }
      >
        <DataTable
          empty="Nenhuma mesa fechada no período."
          head={["Mesa", "Atendimentos", "Pessoas", "Receita", "Por atendimento", "Permanência"]}
          align={["left", "right", "right", "right", "right", "right"]}
          rows={[...mesas]
            .sort((a, b) => b.receita - a.receita)
            .map((m) => [
              `Mesa ${m.numero}`,
              intFmt.format(m.atendimentos),
              intFmt.format(m.pessoas),
              formatCurrency(m.receita),
              formatCurrency(m.atendimentos ? m.receita / m.atendimentos : 0),
              m.permanencia_min !== null ? formatMinutes(m.permanencia_min) : "—",
            ])}
        />
      </Panel>
    </div>
  )
}

/* ---------------------------------------------------------------- Pedidos */

const STATUS_ORDER: OrderStatus[] = ["finalizado", "entregue", "pronto", "em_preparo", "novo", "cancelado", "devolvido"]

function OrdersTab({ data, file }: TabProps) {
  const p = data.pedidos
  const total = Object.values(p.status).reduce((s, n) => s + n, 0)
  const cancelados = (p.status.cancelado ?? 0) + (p.status.devolvido ?? 0)

  return (
    <>
      <section aria-label="Tempos e cancelamentos" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Pedidos no período" value={intFmt.format(total)} hint="inclui cancelados" strong />
        <Tile label="Preparo médio" value={p.preparo_medio_min !== null ? formatMinutes(p.preparo_medio_min) : "—"} hint="do início do preparo até pronto" icon={Timer} />
        <Tile label="Espera média" value={p.espera_media_min !== null ? formatMinutes(p.espera_media_min) : "—"} hint="do envio até pronto" icon={Clock} />
        <Tile label="Cancelados" value={intFmt.format(cancelados)} hint={total ? `${pctFmt.format(cancelados / total)} dos pedidos` : "no período"} icon={XCircle} negative={cancelados > 0 && cancelados / Math.max(total, 1) > 0.05} />
      </section>

      <HourChart data={data} metric="pedidos" title="Pedidos por hora" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Situação dos pedidos"
          onExport={() => downloadCsv(file("pedidos-situacao"), ["Situação", "Pedidos"], STATUS_ORDER.filter((s) => p.status[s]).map((s) => [ORDER_STATUS[s].label, p.status[s]]))}
        >
          {total === 0 ? (
            <Empty text="Nenhum pedido no período." />
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {STATUS_ORDER.filter((s) => p.status[s]).map((s) => {
                const meta = ORDER_STATUS[s]
                return (
                  <li key={s} className="flex items-center gap-2 rounded-xl border p-3">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.badge)}>
                      <meta.icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xl leading-none font-extrabold tabular-nums">{intFmt.format(p.status[s])}</span>
                      <span className="text-xs text-muted-foreground">{meta.label}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Motivos de cancelamento"
          description="Cancelamentos e devoluções informados pela equipe."
          onExport={() => downloadCsv(file("cancelamentos"), ["Motivo", "Pedidos"], p.motivos_cancelamento.map((m) => [m.motivo, m.n]))}
        >
          <RankBars
            empty="Nenhum pedido cancelado no período."
            rows={p.motivos_cancelamento.map((m) => ({ key: m.motivo, label: m.motivo, value: m.n, display: `${intFmt.format(m.n)} ${m.n === 1 ? "pedido" : "pedidos"}` }))}
          />
        </Panel>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- Despesas */

function ExpensesTab({ data, file }: TabProps) {
  const total = data.despesas_categoria.reduce((s, c) => s + c.valor, 0)
  const byType = ["fixa", "variavel", "operacional"].map((t) => ({ tipo: t, valor: data.despesas_categoria.filter((c) => c.tipo === t).reduce((s, c) => s + c.valor, 0) }))

  return (
    <>
      <section aria-label="Despesas por tipo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total de despesas" value={formatCurrency(total)} hint={data.resumo.faturamento ? `${pctFmt.format(total / data.resumo.faturamento)} do faturamento` : "no período"} strong />
        {byType.map((t) => (
          <Tile key={t.tipo} label={`Despesas ${TYPE_LABEL[t.tipo].toLowerCase()}s`} value={formatCurrency(t.valor)} hint={total ? `${pctFmt.format(t.valor / total)} do total` : "—"} />
        ))}
      </section>

      <Panel
        title="Despesas por categoria"
        description="Lançamentos do financeiro no período, pela data da despesa."
        onExport={() =>
          downloadCsv(
            file("despesas-categoria"),
            ["Categoria", "Tipo", "Lançamentos", "Valor (R$)", "Participação"],
            data.despesas_categoria.map((c) => [c.nome, TYPE_LABEL[c.tipo] ?? c.tipo, c.n, c.valor, total ? pctFmt.format(c.valor / total) : ""])
          )
        }
      >
        <RankBars
          color={SERIES.despesas}
          empty="Nenhuma despesa lançada no período."
          rows={data.despesas_categoria.map((c) => ({
            key: c.nome,
            label: c.nome,
            value: c.valor,
            display: formatCurrency(c.valor),
            sub: `${TYPE_LABEL[c.tipo] ?? c.tipo} · ${intFmt.format(c.n)} ${c.n === 1 ? "lançamento" : "lançamentos"} · ${total ? pctFmt.format(c.valor / total) : "0%"}`,
          }))}
        />
      </Panel>
    </>
  )
}

/* ---------------------------------------------------------------- peças */

function formatMinutes(min: number) {
  if (min < 60) return `${intFmt.format(Math.round(min))} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

function Tile({
  label,
  value,
  hint,
  strong,
  negative,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  strong?: boolean
  negative?: boolean
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}) {
  return (
    <div className={cn("grid content-start gap-1 rounded-2xl border bg-card p-4", strong && "border-primary/40")}>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden />}
        {label}
      </span>
      <span className={cn("text-2xl font-extrabold tracking-tight tabular-nums", negative && "text-destructive")}>{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function Panel({ title, description, onExport, className, children }: { title: string; description?: string; onExport?: () => void; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-card p-4 md:p-5", className)} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-bold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {onExport && (
          <Button variant="outline" size="sm" className="h-9" onClick={onExport}>
            <Download className="size-4" aria-hidden /> Exportar CSV
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

function RankBars({
  rows,
  empty,
  color = SERIES.faturamento,
}: {
  rows: { key: string; label: string; value: number; display: string; sub?: string }[]
  empty: string
  color?: string
}) {
  if (rows.length === 0) return <Empty text={empty} />
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ol className="grid gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 font-bold tabular-nums">{r.display}</span>
          </div>
          <div className="h-2 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
          </div>
          {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
        </li>
      ))}
    </ol>
  )
}

function DataTable({ head, rows, align, empty }: { head: string[]; rows: string[][]; align: ("left" | "right")[]; empty: string }) {
  if (rows.length === 0) return <Empty text={empty} />
  return (
    // rolável: recebe foco para quem navega pelo teclado conseguir rolar
    <div className="max-h-[28rem] overflow-auto rounded-xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50" tabIndex={0} role="region" aria-label={`Tabela: ${head.join(", ")}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn("px-3 py-2 font-semibold whitespace-nowrap", align[i] === "right" ? "text-right" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t">
              {r.map((c, ci) => (
                <td key={ci} className={cn("px-3 py-2", align[ci] === "right" ? "text-right tabular-nums whitespace-nowrap" : "text-left", ci === 0 && "font-semibold")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: CsvValue[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}


function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</p>
}
