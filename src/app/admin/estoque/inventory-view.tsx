"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Download, History, Loader2, Pencil, Plus, Search, Package, ChefHat } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/layout/page-header"
import { PeriodFilter } from "@/components/forms/period-filter"
import { NativeSelect } from "@/components/forms/native-select"
import { setAutoDeduction } from "@/features/inventory/actions"
import { MOVEMENT_LABEL, STOCK_LEVEL, formatQty, stockLevel } from "@/features/inventory/format"
import { downloadCsv } from "@/lib/csv"
import { formatCurrency } from "@/lib/format"
import type { ResolvedPeriod } from "@/lib/periods"
import { cn } from "@/lib/utils"
import type { MovementType, RecipeProduct, StockItem, StockMovement, StockSummary } from "@/services/inventory"
import { ItemSheet, type ItemTarget } from "./item-sheet"
import { MovementDialog, type MovementTarget } from "./movement-dialog"
import { RecipeDialog } from "./recipe-dialog"

type Tab = "itens" | "ficha" | "movimentacoes"
const TABS: { id: Tab; label: string }[] = [
  { id: "itens", label: "Itens" },
  { id: "ficha", label: "Ficha técnica" },
  { id: "movimentacoes", label: "Movimentações" },
]

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 })

interface Props {
  items: StockItem[]
  movements: StockMovement[]
  products: RecipeProduct[]
  suppliers: { id: string; nome: string; ativo: boolean }[]
  summary: StockSummary | null
  truncated: boolean
  period: ResolvedPeriod
  today: string
  autoDeduction: boolean
  initialTab: Tab
  initialLowOnly: boolean
}

export function InventoryView(props: Props) {
  const { items, summary, period, today, initialTab } = props
  const [tab, setTab] = useState<Tab>(initialTab)
  const [itemTarget, setItemTarget] = useState<ItemTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<MovementTarget | null>(null)
  const [recipeProduct, setRecipeProduct] = useState<RecipeProduct | null>(null)
  const [historyItem, setHistoryItem] = useState<string>("")

  function select(id: Tab) {
    setTab(id)
    const url = new URL(window.location.href)
    url.searchParams.set("aba", id)
    url.searchParams.delete("filtro")
    window.history.replaceState(null, "", url)
  }

  const active = items.filter((i) => i.ativo)
  const value = active.reduce((s, i) => s + Math.max(0, i.quantidade) * i.custo_unitario, 0)
  const low = active.filter((i) => stockLevel(i.quantidade, i.quantidade_minima) !== "ok")

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Estoque"
        description="Insumos, ficha técnica dos pratos e movimentações."
        actions={
          <Button className="h-11 font-semibold" onClick={() => setItemTarget({ mode: "create" })}>
            <Plus className="size-4" aria-hidden /> Novo item
          </Button>
        }
      />

      {summary === null && (
        <p role="alert" className="mb-6 flex gap-2 rounded-xl border border-status-preparing/40 bg-status-preparing-soft p-4 text-sm font-medium text-status-preparing">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          O estoque precisa de uma atualização no banco: rode o arquivo supabase/migrations/20261002000008_estoque.sql no SQL Editor do Supabase.
        </p>
      )}

      <section aria-label="Resumo do estoque" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Itens ativos" value={String(active.length)} hint={`${items.length - active.length} desativados`} />
        <Tile label="Valor em estoque" value={formatCurrency(value)} hint="quantidade × custo médio" strong />
        <Tile
          label="Precisam de reposição"
          value={String(low.length)}
          hint={low.length ? low.slice(0, 2).map((i) => i.nome).join(", ") + (low.length > 2 ? "…" : "") : "tudo acima do mínimo"}
          alert={low.length > 0}
        />
        <AutoDeductionTile enabled={props.autoDeduction} />
      </section>

      <div role="tablist" aria-label="Seções do estoque" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`aba-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="painel-estoque"
            onClick={() => select(t.id)}
            className={cn(
              "-mb-px h-11 shrink-0 border-b-2 px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.id === "itens" && low.length > 0 && (
              <span className="ml-2 rounded-full bg-status-preparing-soft px-1.5 py-0.5 text-xs text-status-preparing">{low.length}</span>
            )}
          </button>
        ))}
      </div>

      <div id="painel-estoque" role="tabpanel" aria-labelledby={`aba-${tab}`}>
        {tab === "itens" && (
          <ItemsTab
            items={items}
            initialLowOnly={props.initialLowOnly}
            onMove={setMoveTarget}
            onEdit={(item) => setItemTarget({ mode: "edit", item })}
            onHistory={(id) => {
              setHistoryItem(id)
              select("movimentacoes")
            }}
          />
        )}
        {tab === "ficha" && <RecipesTab products={props.products} items={items} onEdit={setRecipeProduct} />}
        {tab === "movimentacoes" && (
          <>
            <div className="mb-6">
              <PeriodFilter key={`${period.inicio}:${period.fim}`} basePath="/admin/estoque" period={period} today={today} preserve={["aba"]} />
            </div>
            <MovementsTab
              movements={props.movements}
              items={items}
              summary={summary}
              truncated={props.truncated}
              period={period}
              itemFilter={historyItem}
              onItemFilter={setHistoryItem}
            />
          </>
        )}
      </div>

      <ItemSheet target={itemTarget} suppliers={props.suppliers} onClose={() => setItemTarget(null)} />
      <MovementDialog target={moveTarget} onClose={() => setMoveTarget(null)} />
      <RecipeDialog product={recipeProduct} items={items} onClose={() => setRecipeProduct(null)} />
    </div>
  )
}

/* ---------------------------------------------------------------- Itens */

function ItemsTab({
  items,
  initialLowOnly,
  onMove,
  onEdit,
  onHistory,
}: {
  items: StockItem[]
  initialLowOnly: boolean
  onMove: (t: MovementTarget) => void
  onEdit: (item: StockItem) => void
  onHistory: (id: string) => void
}) {
  const [q, setQ] = useState("")
  const [view, setView] = useState<"ativos" | "baixo" | "inativos">(initialLowOnly ? "baixo" : "ativos")

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("pt-BR")
    return items.filter((i) => {
      if (view === "inativos" ? i.ativo : !i.ativo) return false
      if (view === "baixo" && stockLevel(i.quantidade, i.quantidade_minima) === "ok") return false
      return !term || i.nome.toLocaleLowerCase("pt-BR").includes(term) || i.fornecedor?.nome.toLocaleLowerCase("pt-BR").includes(term)
    })
  }, [items, q, view])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item ou fornecedor" className="h-11 pl-9" aria-label="Buscar item" />
        </div>
        <div role="radiogroup" aria-label="Mostrar" className="flex gap-1 rounded-xl bg-muted p-1">
          {(
            [
              ["ativos", "Ativos"],
              ["baixo", "Repor"],
              ["inativos", "Desativados"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={view === id}
              onClick={() => setView(id)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                view === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
          <Package className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">
            {view === "baixo" ? "Nenhum item precisa de reposição." : q ? "Nenhum item encontrado com essa busca." : "Nenhum item nesta lista."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {filtered.map((item) => {
            const level = STOCK_LEVEL[stockLevel(item.quantidade, item.quantidade_minima)]
            return (
              <li key={item.id} className={cn("grid gap-3 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center", !item.ativo && "opacity-70")}>
                <div className="min-w-0">
                  <p className="truncate font-bold">{item.nome}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.fornecedor?.nome ?? "Sem fornecedor"} · custo médio {formatCurrency(item.custo_unitario)}/{item.unidade}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-xl font-extrabold tabular-nums">{formatQty(item.quantidade, item.unidade)}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", level.badge)}>
                    <level.icon className="size-3.5" aria-hidden />
                    {level.label}
                  </span>
                  <span className="text-xs text-muted-foreground">mín. {formatQty(item.quantidade_minima, item.unidade)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-10" onClick={() => onMove({ item, tipo: "entrada" })} disabled={!item.ativo}>
                    <ArrowDownToLine className="size-4" aria-hidden /> Entrada
                  </Button>
                  <Button variant="outline" className="h-10" onClick={() => onMove({ item, tipo: "saida" })} disabled={!item.ativo || item.quantidade <= 0}>
                    <ArrowUpFromLine className="size-4" aria-hidden /> Saída
                  </Button>
                  <Button variant="outline" className="h-10" onClick={() => onMove({ item, tipo: "ajuste" })} disabled={!item.ativo}>
                    <ClipboardCheck className="size-4" aria-hidden /> Contagem
                  </Button>
                  <Button variant="ghost" size="icon-lg" className="size-10" onClick={() => onHistory(item.id)} aria-label={`Histórico de ${item.nome}`}>
                    <History />
                  </Button>
                  <Button variant="ghost" size="icon-lg" className="size-10" onClick={() => onEdit(item)} aria-label={`Editar ${item.nome}`}>
                    <Pencil />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Ficha técnica */

function RecipesTab({ products, items, onEdit }: { products: RecipeProduct[]; items: StockItem[]; onEdit: (p: RecipeProduct) => void }) {
  const [onlyMissing, setOnlyMissing] = useState(false)
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const list = products.filter((p) => p.ativo && (!onlyMissing || p.ingredientes.length === 0))
  const withRecipe = products.filter((p) => p.ativo && p.ingredientes.length > 0).length
  const total = products.filter((p) => p.ativo).length

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {withRecipe} de {total} produtos com ficha técnica. Com a baixa automática ligada, cada pedido finalizado desconta esses ingredientes do estoque.
        </p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} aria-label="Mostrar só produtos sem ficha técnica" />
          Só produtos sem ficha
        </label>
      </div>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center font-semibold">Todos os produtos ativos já têm ficha técnica.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.map((p) => {
            const cost = p.ingredientes.reduce((s, g) => s + g.quantidade * (byId.get(g.item_estoque_id)?.custo_unitario ?? 0), 0)
            const share = p.preco > 0 ? cost / p.preco : 0
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onEdit(p)}
                  className="grid h-full w-full gap-2 rounded-2xl border bg-card p-4 text-left outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.categoria?.nome ?? "Sem categoria"} · {formatCurrency(p.preco)}
                      </span>
                    </span>
                    <ChefHat className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </span>
                  {p.ingredientes.length === 0 ? (
                    <span className="text-sm font-semibold text-primary">Montar ficha técnica</span>
                  ) : (
                    <>
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {p.ingredientes
                          .map((g) => {
                            const it = byId.get(g.item_estoque_id)
                            return it ? `${it.nome} ${formatQty(g.quantidade, it.unidade)}` : null
                          })
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="flex flex-wrap gap-x-3 text-sm">
                        <span>
                          Custo dos ingredientes: <strong className="tabular-nums">{formatCurrency(cost)}</strong>
                        </span>
                        <span className={cn("font-semibold", share > 0.4 ? "text-destructive" : "text-muted-foreground")}>{pct.format(share)} do preço</span>
                      </span>
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Movimentações */

const TYPE_STYLE: Record<MovementType, string> = {
  entrada: "bg-status-free-soft text-status-free",
  saida: "bg-destructive/10 text-destructive",
  ajuste: "bg-status-payment-soft text-status-payment",
  consumo: "bg-status-preparing-soft text-status-preparing",
}

function MovementsTab({
  movements,
  items,
  summary,
  truncated,
  period,
  itemFilter,
  onItemFilter,
}: {
  movements: StockMovement[]
  items: StockItem[]
  summary: StockSummary | null
  truncated: boolean
  period: ResolvedPeriod
  itemFilter: string
  onItemFilter: (id: string) => void
}) {
  const [type, setType] = useState<"" | MovementType>("")
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const list = movements.filter((m) => (!itemFilter || m.item_estoque_id === itemFilter) && (!type || m.tipo === type))
  const t = summary?.totais ?? {}

  function exportCsv() {
    downloadCsv(
      `movimentacoes-estoque-${period.inicio}-a-${period.fim}`,
      ["Data", "Item", "Tipo", "Quantidade", "Unidade", "Custo unitário (R$)", "Motivo", "Responsável"],
      list.map((m) => {
        const it = byId.get(m.item_estoque_id)
        return [
          dateTime.format(new Date(m.criado_em)),
          it?.nome ?? "",
          MOVEMENT_LABEL[m.tipo],
          m.quantidade,
          it?.unidade ?? "",
          m.custo_unitario,
          m.pedido ? `${m.motivo ?? ""} #${m.pedido.numero}` : m.motivo,
          m.autor?.nome ?? "Sistema",
        ]
      })
    )
  }

  return (
    <div className="grid gap-4">
      <section aria-label="Totais do período" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Entradas" value={formatCurrency(t.entrada?.valor ?? 0)} hint={`${t.entrada?.n ?? 0} lançamentos`} />
        <Tile label="Consumo nos pedidos" value={formatCurrency(t.consumo?.valor ?? 0)} hint={`${t.consumo?.n ?? 0} baixas automáticas`} />
        <Tile label="Saídas e perdas" value={formatCurrency(t.saida?.valor ?? 0)} hint={`${t.saida?.n ?? 0} lançamentos`} alert={(t.saida?.valor ?? 0) > 0} />
        <Tile
          label="Diferença nas contagens"
          value={formatCurrency(summary?.ajuste_liquido ?? 0)}
          hint={`${t.ajuste?.n ?? 0} contagens · ${(summary?.ajuste_liquido ?? 0) < 0 ? "faltou mercadoria" : "a valor de custo"}`}
          alert={(summary?.ajuste_liquido ?? 0) < 0}
        />
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-52 gap-1 text-xs font-semibold text-muted-foreground">
          Item
          <NativeSelect value={itemFilter} onChange={(e) => onItemFilter(e.target.value)} className="h-10 text-sm">
            <option value="">Todos os itens</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid min-w-40 gap-1 text-xs font-semibold text-muted-foreground">
          Tipo
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as "" | MovementType)} className="h-10 text-sm">
            <option value="">Todos</option>
            {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((k) => (
              <option key={k} value={k}>
                {MOVEMENT_LABEL[k]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button variant="outline" className="ml-auto h-10" onClick={exportCsv} disabled={list.length === 0}>
          <Download className="size-4" aria-hidden /> Exportar CSV
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center font-semibold">Nenhuma movimentação neste período.</p>
      ) : (
        // rola para os lados no celular: recebe foco para rolar pelo teclado
        <div className="overflow-x-auto rounded-2xl border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50" tabIndex={0} role="region" aria-label="Movimentações do período">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Quando</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Item</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Quantidade</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Motivo</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Por</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const it = byId.get(m.item_estoque_id)
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{dateTime.format(new Date(m.criado_em))}</td>
                    <td className="px-3 py-2 font-semibold">{it?.nome ?? "Item excluído"}</td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TYPE_STYLE[m.tipo])}>{MOVEMENT_LABEL[m.tipo]}</span>
                    </td>
                    <td className={cn("px-3 py-2 text-right font-bold whitespace-nowrap tabular-nums", m.quantidade < 0 ? "text-destructive" : "text-status-free")}>
                      {m.quantidade > 0 ? "+" : ""}
                      {formatQty(m.quantidade, it?.unidade)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.motivo}
                      {m.pedido && ` · pedido #${m.pedido.numero}`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{m.autor?.nome ?? "Sistema"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {truncated && <p className="text-sm text-muted-foreground">Mostrando as 500 movimentações mais recentes. Escolha um período menor para ver as demais.</p>}
    </div>
  )
}

/* ---------------------------------------------------------------- peças */

function AutoDeductionTile({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <div className="grid content-start gap-1 rounded-2xl border bg-card p-4">
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
        <label htmlFor="baixa-automatica">Baixa automática</label>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Switch
            id="baixa-automatica"
            aria-label="Baixa automática do estoque"
            checked={enabled}
            onCheckedChange={async (v) => {
              setBusy(true)
              const r = await setAutoDeduction(v)
              setBusy(false)
              if (!r.ok) toast.error(r.error)
              else {
                toast.success(v ? "Baixa automática ligada." : "Baixa automática desligada.")
                router.refresh()
              }
            }}
          />
        )}
      </span>
      <span className="text-2xl font-extrabold tracking-tight">{enabled ? "Ligada" : "Desligada"}</span>
      <span className="text-xs text-muted-foreground">{enabled ? "pedidos finalizados descontam a ficha técnica" : "o estoque só muda pelos lançamentos manuais"}</span>
    </div>
  )
}

function Tile({ label, value, hint, strong, alert }: { label: string; value: string; hint?: string; strong?: boolean; alert?: boolean }) {
  return (
    <div className={cn("grid content-start gap-1 rounded-2xl border bg-card p-4", strong && "border-primary/40", alert && "border-status-preparing/50")}>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        {alert && <AlertTriangle className="size-4 text-status-preparing" aria-hidden />}
        {label}
      </span>
      <span className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</span>
      {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}
