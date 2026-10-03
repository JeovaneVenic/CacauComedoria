"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Paperclip, Plus, Receipt, Search, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/forms/native-select"
import { PageHeader } from "@/components/layout/page-header"
import { getReceiptUrl } from "@/features/finance/actions"
import { formatCurrency } from "@/lib/format"
import { PERIOD_LABELS, formatYmd, type PeriodKey, type ResolvedPeriod } from "@/lib/periods"
import { FORMA_LABEL } from "@/schemas/common"
import { cn } from "@/lib/utils"
import type { Expense, ExpenseCategory, ExpenseType, FinanceSummary, Supplier } from "@/services/finance"
import { ExpenseSheet, type ExpenseTarget } from "./expense-sheet"
import { SuppliersDialog } from "./suppliers-dialog"

export const TYPE_LABEL: Record<ExpenseType, string> = { fixa: "Fixas", variavel: "Variáveis", operacional: "Operacionais" }
const TYPE_HINT: Record<ExpenseType, string> = {
  fixa: "aluguel, salários, contas",
  variavel: "alimentos, bebidas, fornecedores",
  operacional: "gás, manutenção, limpeza",
}
const TYPE_COLOR: Record<ExpenseType, string> = { fixa: "bg-status-payment", variavel: "bg-primary", operacional: "bg-status-preparing" }

const PAGE_SIZE = 20

interface FinanceViewProps {
  restaurantId: string
  period: ResolvedPeriod
  today: string
  summary: FinanceSummary
  expenses: Expense[]
  categories: ExpenseCategory[]
  suppliers: Supplier[]
}

export function FinanceView({ restaurantId, period, today, summary, expenses, categories, suppliers }: FinanceViewProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [type, setType] = useState<ExpenseType | "">("")
  const [page, setPage] = useState(0)
  const [target, setTarget] = useState<ExpenseTarget | null>(null)
  const [suppliersOpen, setSuppliersOpen] = useState(false)
  const [from, setFrom] = useState(period.inicio)
  const [to, setTo] = useState(period.fim)

  const q = query.trim().toLocaleLowerCase("pt-BR")
  const filtered = useMemo(
    () =>
      expenses.filter(
        (e) =>
          (!category || e.categoria_id === category) &&
          (!type || e.categoria?.tipo === type) &&
          (!q || e.descricao.toLocaleLowerCase("pt-BR").includes(q) || e.fornecedor?.nome.toLocaleLowerCase("pt-BR").includes(q))
      ),
    [expenses, category, type, q]
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const filteredTotal = filtered.reduce((s, e) => s + e.valor, 0)

  function go(key: PeriodKey, de?: string, ate?: string) {
    const params = new URLSearchParams({ periodo: key })
    if (de && ate) {
      params.set("de", de)
      params.set("ate", ate)
    }
    setPage(0)
    router.push(`/admin/financeiro?${params}`)
  }

  async function openReceipt(path: string) {
    const result = await getReceiptUrl(path)
    if (!result.ok || !result.data) toast.error(result.ok ? "Não foi possível abrir o comprovante." : result.error)
    else window.open(result.data, "_blank", "noopener")
  }

  const s = summary
  const maxCat = Math.max(1, ...s.porCategoria.map((c) => c.valor))
  const maxForma = Math.max(1, ...s.porForma.map((f) => f.valor))

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Financeiro"
        description={`Receitas e despesas · ${period.label}`}
        actions={
          <>
            <Button variant="outline" className="h-11" onClick={() => setSuppliersOpen(true)}>
              <Truck className="size-4" aria-hidden /> Fornecedores
            </Button>
            <Button className="h-11 font-semibold" onClick={() => setTarget({ mode: "create" })}>
              <Plus className="size-4" aria-hidden /> Nova despesa
            </Button>
          </>
        }
      />

      {/* Período */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {(["hoje", "7dias", "mes", "mes_passado"] as PeriodKey[]).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={period.key === k}
              onClick={() => go(k)}
              className={cn(
                "h-10 rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                period.key === k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PERIOD_LABELS[k]}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            go("personalizado", from, to)
          }}
        >
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            De
            <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Até
            <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="h-10" />
          </label>
          <Button type="submit" variant={period.key === "personalizado" ? "default" : "outline"} className="h-10">
            Aplicar
          </Button>
        </form>
      </div>

      {/* Indicadores */}
      <section aria-label="Indicadores financeiros" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile label="Receita" value={s.receita} hint={`${s.pedidos} pedidos`} strong />
        <Tile label="Despesas" value={s.despesas} hint={`${expenses.length} lançamentos`} />
        <Tile label="Lucro bruto" value={s.lucroBruto} hint={`receita − ${formatCurrency(s.custoMercadoria)} em mercadoria`} />
        <Tile label="Lucro estimado" value={s.lucroEstimado} hint="receita − todas as despesas" />
        <Tile label="Ticket médio" value={s.ticketMedio} hint="receita ÷ pedidos" />
      </section>

      {/* Distribuição */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="por-tipo" className="rounded-2xl border bg-card p-4">
          <h2 id="por-tipo" className="font-bold">
            Despesas por tipo
          </h2>
          <ul className="mt-3 grid gap-3">
            {(Object.keys(TYPE_LABEL) as ExpenseType[]).map((t) => {
              const pct = s.despesas ? Math.round((s.porTipo[t] / s.despesas) * 100) : 0
              return (
                <li key={t}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold">{TYPE_LABEL[t]}</span>
                      <span className="block truncate text-xs text-muted-foreground">{TYPE_HINT[t]}</span>
                    </span>
                    <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">{formatCurrency(s.porTipo[t])}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className={cn("h-full rounded-full", TYPE_COLOR[t])} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{pct}% das despesas</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="por-categoria" className="rounded-2xl border bg-card p-4">
          <h2 id="por-categoria" className="font-bold">
            Maiores despesas por categoria
          </h2>
          {s.porCategoria.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma despesa no período.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {s.porCategoria.slice(0, 7).map((c) => (
                <li key={c.nome} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
                  <span className="truncate">{c.nome}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className={cn("block h-full rounded-full", TYPE_COLOR[c.tipo])} style={{ width: `${(c.valor / maxCat) * 100}%` }} />
                  </span>
                  <span className="font-semibold whitespace-nowrap tabular-nums">{formatCurrency(c.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="por-forma" className="rounded-2xl border bg-card p-4">
          <h2 id="por-forma" className="font-bold">
            Receita por forma de pagamento
          </h2>
          {s.porForma.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum pagamento no período.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {s.porForma.map((f) => (
                <li key={f.forma} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2 text-sm">
                  <span>{FORMA_LABEL[f.forma] ?? f.forma}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-status-free" style={{ width: `${(f.valor / maxForma) * 100}%` }} />
                  </span>
                  <span className="font-semibold whitespace-nowrap tabular-nums">{formatCurrency(f.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Lançamentos */}
      <section aria-labelledby="lancamentos" className="mt-6 rounded-2xl border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
          <div>
            <h2 id="lancamentos" className="font-bold">
              Despesas lançadas
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "despesa" : "despesas"} · {formatCurrency(filteredTotal)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
                placeholder="Buscar descrição ou fornecedor"
                aria-label="Buscar despesas"
                className="h-11 w-60 pl-9"
              />
            </div>
            <NativeSelect
              value={type}
              onChange={(e) => {
                setType(e.target.value as ExpenseType | "")
                setPage(0)
              }}
              className="h-11 w-40"
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos os tipos</option>
              {(Object.keys(TYPE_LABEL) as ExpenseType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setPage(0)
              }}
              className="h-11 w-48"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="grid place-items-center gap-2 p-10 text-center">
            <Receipt className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-semibold">{expenses.length === 0 ? "Não existem despesas cadastradas no período." : "Nenhuma despesa encontrada."}</p>
            {expenses.length === 0 && (
              <Button className="mt-1 h-11" onClick={() => setTarget({ mode: "create" })}>
                <Plus className="size-4" aria-hidden /> Lançar despesa
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2 font-semibold">Data</th>
                    <th className="px-4 py-2 font-semibold">Descrição</th>
                    <th className="px-4 py-2 font-semibold">Categoria</th>
                    <th className="px-4 py-2 font-semibold">Pagamento</th>
                    <th className="px-4 py-2 text-right font-semibold">Valor</th>
                    <th className="w-12 px-2 py-2">
                      <span className="sr-only">Comprovante</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatYmd(e.data)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setTarget({ mode: "edit", expense: e })}
                          className="text-left font-semibold underline-offset-4 outline-none hover:underline focus-visible:underline"
                        >
                          {e.descricao}
                        </button>
                        {e.fornecedor && <span className="block text-xs text-muted-foreground">{e.fornecedor.nome}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className={cn("size-2 rounded-full", TYPE_COLOR[e.categoria?.tipo ?? "variavel"])} />
                          {e.categoria?.nome ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{FORMA_LABEL[e.forma_pagamento]}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatCurrency(e.valor)}</td>
                      <td className="px-2 py-3">
                        {e.comprovante_caminho && (
                          <Button variant="ghost" size="icon-lg" className="size-9" onClick={() => openReceipt(e.comprovante_caminho!)} aria-label={`Abrir comprovante de ${e.descricao}`}>
                            <Paperclip className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between border-t p-3 text-sm">
                <span className="text-muted-foreground">
                  Página {current + 1} de {pages}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" className="h-10" disabled={current === 0} onClick={() => setPage(current - 1)}>
                    <ChevronLeft className="size-4" aria-hidden /> Anterior
                  </Button>
                  <Button variant="outline" className="h-10" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                    Próxima <ChevronRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <ExpenseSheet
        target={target}
        restaurantId={restaurantId}
        today={today}
        categories={categories}
        suppliers={suppliers}
        onClose={() => setTarget(null)}
        onManageSuppliers={() => setSuppliersOpen(true)}
      />
      <SuppliersDialog open={suppliersOpen} onOpenChange={setSuppliersOpen} suppliers={suppliers} />
    </div>
  )
}

function Tile({ label, value, hint, strong }: { label: string; value: number; hint: string; strong?: boolean }) {
  return (
    <div className={cn("grid gap-1 rounded-2xl border bg-card p-4", strong && "border-primary/40")}>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-extrabold tracking-tight tabular-nums", value < 0 && "text-destructive")}>{formatCurrency(value)}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}
