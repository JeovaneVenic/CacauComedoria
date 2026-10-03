"use client"

import { useMemo, useState } from "react"
import { Loader2, Minus, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ModifierDialog, type ModifierChoice } from "./modifier-dialog"
import { addOrderItems } from "@/features/orders/api"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MenuData } from "@/services/menu"
import type { ModifierGroup, Product } from "@/types/domain"

interface PendingItem {
  key: string
  product: Product
  choice: ModifierChoice
}

interface AddItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  orderNumber: number
  menu: MenuData
  onDone: () => void
}

/** Gestão adiciona itens a um pedido já enviado */
export function AddItemsDialog({ open, onOpenChange, orderId, orderNumber, menu, onDone }: AddItemsDialogProps) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(menu.categories[0]?.id ?? "")
  const [pending, setPending] = useState<PendingItem[]>([])
  const [customizing, setCustomizing] = useState<Product | null>(null)
  const [busy, setBusy] = useState(false)

  const groupsByProduct = useMemo(() => {
    const byId = new Map(menu.groups.map((g) => [g.id, g]))
    const map = new Map<string, ModifierGroup[]>()
    ;[...menu.links]
      .sort((a, b) => a.ordem - b.ordem)
      .forEach((l) => {
        const g = byId.get(l.grupo_id)
        if (g && g.opcoes.some((o) => o.ativa)) map.set(l.produto_id, [...(map.get(l.produto_id) ?? []), g])
      })
    return map
  }, [menu.groups, menu.links])

  const q = query.trim().toLocaleLowerCase("pt-BR")
  const visible = menu.products.filter((p) => p.ativo && (q ? p.nome.toLocaleLowerCase("pt-BR").includes(q) : p.categoria_id === category))
  const total = pending.reduce((s, i) => s + i.choice.unitPrice * i.choice.quantity, 0)

  function add(product: Product, choice: ModifierChoice) {
    setPending((list) => [...list, { key: crypto.randomUUID(), product, choice }])
    setCustomizing(null)
  }

  function tap(p: Product) {
    if (groupsByProduct.has(p.id)) setCustomizing(p)
    else add(p, { optionIds: [], optionLabels: [], unitPrice: p.preco, quantity: 1, notes: "" })
  }

  async function save() {
    setBusy(true)
    const result = await addOrderItems(
      orderId,
      pending.map((i) => ({
        produto_id: i.product.id,
        quantidade: i.choice.quantity,
        observacao: i.choice.notes || null,
        opcoes_ids: i.choice.optionIds,
      }))
    )
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${pending.length} ${pending.length === 1 ? "item adicionado" : "itens adicionados"} ao pedido #${orderNumber}.`)
    setPending([])
    onOpenChange(false)
    onDone()
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setPending([])
          onOpenChange(o)
        }}
      >
        <DialogContent className="max-h-[92dvh] grid-cols-1 gap-4 overflow-y-auto p-5 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Adicionar itens ao pedido #{orderNumber}</DialogTitle>
            <DialogDescription>Os itens entram no mesmo pedido e aparecem para a cozinha.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" className="h-11 pl-10" />
          </div>
          {!q && (
            <div role="tablist" aria-label="Categorias" className="flex gap-2 overflow-x-auto pb-1">
              {menu.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "h-10 shrink-0 rounded-lg px-4 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    category === c.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
                  )}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => tap(p)}
                  className="flex h-full w-full flex-col items-start gap-1 rounded-xl border-2 p-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="leading-snug font-semibold">{p.nome}</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(p.preco)}</span>
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="col-span-full text-sm text-muted-foreground">Nenhum produto encontrado.</li>}
          </ul>

          {pending.length > 0 && (
            <section aria-label="Itens a adicionar" className="grid gap-2 rounded-xl border bg-muted/40 p-3">
              {pending.map((i) => (
                <div key={i.key} className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border bg-card">
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="size-9"
                      onClick={() =>
                        setPending((l) =>
                          l.map((x) => (x.key === i.key ? { ...x, choice: { ...x.choice, quantity: Math.max(1, x.choice.quantity - 1) } } : x))
                        )
                      }
                      aria-label={`Diminuir ${i.product.nome}`}
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center font-bold">{i.choice.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="size-9"
                      onClick={() =>
                        setPending((l) => l.map((x) => (x.key === i.key ? { ...x, choice: { ...x.choice, quantity: x.choice.quantity + 1 } } : x)))
                      }
                      aria-label={`Aumentar ${i.product.nome}`}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{i.product.nome}</span>
                    {(i.choice.optionLabels.length > 0 || i.choice.notes) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[...i.choice.optionLabels, i.choice.notes && `“${i.choice.notes}”`].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(i.choice.unitPrice * i.choice.quantity)}</span>
                  <Button variant="ghost" size="icon-lg" className="size-9" onClick={() => setPending((l) => l.filter((x) => x.key !== i.key))} aria-label={`Tirar ${i.product.nome}`}>
                    <X />
                  </Button>
                </div>
              ))}
            </section>
          )}

          <div className="flex gap-2 border-t pt-4">
            <Button variant="outline" className="h-12 flex-1" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button className="h-12 flex-[2] font-semibold" disabled={!pending.length || busy} onClick={save}>
              {busy && <Loader2 className="animate-spin" />}
              Adicionar {pending.length > 0 && `· ${formatCurrency(total)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModifierDialog
        product={customizing}
        groups={customizing ? (groupsByProduct.get(customizing.id) ?? []) : []}
        onClose={() => setCustomizing(null)}
        onConfirm={add}
      />
    </>
  )
}
