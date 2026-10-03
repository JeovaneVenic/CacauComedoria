"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { ModifierDialog, type ModifierChoice } from "@/features/orders/components/modifier-dialog"
import { OrderSummary } from "@/features/orders/components/order-summary"
import { cartTotals, useCartStore } from "@/stores/cart-store"
import { submitCart } from "@/features/orders/outbox"
import { formatCurrency, tableLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Category, ModifierGroup, Product, ProductGroupLink, TableOverview } from "@/types/domain"

interface OrderBuilderProps {
  table: TableOverview
  waiterName: string
  serviceFeePercent: number
  categories: Category[]
  products: Product[]
  groups: ModifierGroup[]
  links: ProductGroupLink[]
}

export function OrderBuilder({ table, waiterName, serviceFeePercent, categories, products, groups, links }: OrderBuilderProps) {
  const router = useRouter()
  const tableId = table.id
  const [hydrated, setHydrated] = useState(false)
  const [category, setCategory] = useState(categories[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [customizing, setCustomizing] = useState<Product | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [sending, setSending] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cart = useCartStore((s) => s.carts[tableId])
  const { addLine, setQuantity, removeLine, setNote, clear } = useCartStore.getState()

  // O carrinho fica salvo no aparelho: recarregar a página não perde o pedido
  useEffect(() => {
    Promise.resolve(useCartStore.persist.rehydrate()).then(() => setHydrated(true))
  }, [])

  const groupsByProduct = useMemo(() => {
    const byId = new Map(groups.map((g) => [g.id, g]))
    const map = new Map<string, ModifierGroup[]>()
    ;[...links]
      .sort((a, b) => a.ordem - b.ordem)
      .forEach((l) => {
        const g = byId.get(l.grupo_id)
        if (g && g.opcoes.some((o) => o.ativa)) map.set(l.produto_id, [...(map.get(l.produto_id) ?? []), g])
      })
    return map
  }, [groups, links])

  const inCart = useMemo(() => {
    const m = new Map<string, number>()
    cart?.items.forEach((l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity))
    return m
  }, [cart])

  const normalized = query.trim().toLocaleLowerCase("pt-BR")
  const visible = normalized
    ? products.filter((p) => p.nome.toLocaleLowerCase("pt-BR").includes(normalized))
    : products.filter((p) => p.categoria_id === category)

  const locked = !!cart?.unconfirmed
  const totals = cartTotals(cart?.items ?? [], serviceFeePercent)

  function pulse(productId: string) {
    setFlash(productId)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 600)
  }

  function tapProduct(p: Product) {
    if (!p.ativo) {
      toast.error("Este produto está indisponível.")
      return
    }
    if (locked) {
      toast.warning("Confirme o envio pendente antes de adicionar itens.")
      return
    }
    if (groupsByProduct.has(p.id)) {
      setCustomizing(p)
      return
    }
    // um toque adiciona
    addLine(tableId, { productId: p.id, name: p.nome, unitPrice: p.preco, quantity: 1, optionIds: [], optionLabels: [], notes: "" })
    pulse(p.id)
  }

  function addCustomized(p: Product, choice: ModifierChoice) {
    addLine(tableId, { productId: p.id, name: p.nome, ...choice })
    setCustomizing(null)
    pulse(p.id)
  }

  async function send() {
    if (!useCartStore.getState().carts[tableId]?.items.length || sending) return
    setSending(true)
    const result = await submitCart(tableId, { tableNumber: table.numero, pessoas: table.pessoas })
    setSending(false)

    if (result.status === "rejected") {
      toast.error(result.message)
      return
    }
    if (result.status === "pending") {
      // fica na fila do aparelho com a mesma chave: será reenviado sozinho, sem duplicar
      toast.warning(
        navigator.onLine
          ? "Não recebemos a confirmação. O pedido ficou na fila e será reenviado automaticamente."
          : "Sem conexão. O pedido ficou guardado neste aparelho e será enviado sozinho quando a internet voltar.",
        { duration: 8000 }
      )
      return
    }
    setCartOpen(false)
    toast.success(
      result.duplicado ? `O pedido #${result.numero} já tinha chegado à cozinha.` : `Pedido #${result.numero} enviado para a cozinha.`
    )
    router.push(`/garcom/mesa/${tableId}`)
    router.refresh()
  }

  const summary = (
    <OrderSummary
      tableNumber={table.numero}
      waiterName={waiterName}
      cart={hydrated ? cart : undefined}
      serviceFeePercent={serviceFeePercent}
      sending={sending}
      onQuantity={(lineId, q) => setQuantity(tableId, lineId, q)}
      onRemove={(lineId) => removeLine(tableId, lineId)}
      onNote={(note) => setNote(tableId, note)}
      onSend={send}
      onDiscard={() => setConfirmDiscard(true)}
      className="h-full"
    />
  )

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 grid md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem]">
      {/* Cardápio */}
      <div className="flex min-h-0 flex-col">
        <div className="grid gap-3 border-b bg-background px-4 pt-3 pb-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/garcom/mesa/${tableId}`}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg pr-2 font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-5" aria-hidden />
              <span className="font-extrabold text-foreground">{tableLabel(table.numero)}</span>
            </Link>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar no cardápio"
                aria-label="Buscar no cardápio"
                className="h-11 pr-10 pl-10 text-base"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Limpar busca"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          {!normalized && (
            <div role="tablist" aria-label="Categorias" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "h-12 shrink-0 rounded-xl px-5 text-base font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                    category === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent"
                  )}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-28 md:px-6 md:pb-6">
          {visible.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
              <p className="font-semibold">Nenhum produto encontrado.</p>
              <p className="text-sm text-muted-foreground">Tente outra categoria ou outro nome.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((p) => {
                const qty = inCart.get(p.id) ?? 0
                const custom = groupsByProduct.has(p.id)
                return (
                  <li key={p.id} className="grid">
                    <button
                      type="button"
                      onClick={() => tapProduct(p)}
                      aria-disabled={!p.ativo}
                      aria-label={`${p.nome}, ${formatCurrency(p.preco)}${p.ativo ? (custom ? ", personalizar" : ", adicionar") : ", indisponível"}${qty ? `, ${qty} no pedido` : ""}`}
                      className={cn(
                        "relative flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-card text-left transition-[transform,border-color,box-shadow] outline-none active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/50",
                        qty ? "border-primary" : "border-border",
                        flash === p.id && "ring-4 ring-primary/40",
                        !p.ativo && "opacity-55"
                      )}
                    >
                      {/* sem foto, o cartão fica compacto para caber mais itens na tela */}
                      {p.imagem_url && (
                        <div className="relative aspect-[16/10] w-full bg-muted">
                          <Image
                            src={p.imagem_url}
                            alt=""
                            fill
                            sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 22vw, 45vw"
                            className={cn("object-cover", !p.ativo && "grayscale")}
                          />
                        </div>
                      )}
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 z-10 grid h-8 min-w-8 place-items-center rounded-full bg-primary px-2 text-base font-extrabold text-primary-foreground shadow">
                          {qty}
                        </span>
                      )}
                      <div className="flex min-h-28 flex-1 flex-col gap-1 p-3 pr-12">
                        {!p.ativo && (
                          <span className="w-fit rounded-full bg-destructive px-2 py-0.5 text-[0.7rem] font-bold text-white uppercase">
                            Indisponível
                          </span>
                        )}
                        <span className="text-base leading-snug font-bold">{p.nome}</span>
                        {p.descricao && <span className="line-clamp-1 text-sm text-muted-foreground">{p.descricao}</span>}
                        <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                          <span className="text-lg font-extrabold whitespace-nowrap tabular-nums">{formatCurrency(p.preco)}</span>
                          {custom && p.ativo && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
                              <SlidersHorizontal className="size-3.5" aria-hidden /> Opções
                              <ChevronRight className="size-3.5" aria-hidden />
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Resumo fixo no tablet */}
      <aside className="hidden min-h-0 border-l md:block">{summary}</aside>

      {/* Barra inferior no celular */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        <Button onClick={() => setCartOpen(true)} className="h-14 w-full justify-between px-5 text-base font-bold">
          <span className="inline-flex items-center gap-2">
            <ShoppingBag className="size-5" aria-hidden />
            Ver pedido {totals.count > 0 && `(${totals.count})`}
          </span>
          <span className="tabular-nums">{formatCurrency(totals.total)}</span>
        </Button>
      </div>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[88dvh] gap-0 rounded-t-2xl p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Pedido atual</SheetTitle>
          {summary}
        </SheetContent>
      </Sheet>

      <ModifierDialog
        product={customizing}
        groups={customizing ? (groupsByProduct.get(customizing.id) ?? []) : []}
        onClose={() => setCustomizing(null)}
        onConfirm={addCustomized}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Tem certeza que deseja limpar o pedido?"
        description="Os itens ainda não enviados serão removidos."
        onConfirm={() => {
          clear(tableId)
          setConfirmDiscard(false)
        }}
      />
    </div>
  )
}
