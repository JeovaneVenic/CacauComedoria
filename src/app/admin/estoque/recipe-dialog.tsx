"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/forms/native-select"
import { saveRecipe } from "@/features/inventory/actions"
import { toQtyInput } from "@/features/inventory/format"
import { formatCurrency } from "@/lib/format"
import type { RecipeProduct, StockItem } from "@/services/inventory"

type Row = { key: string; item_estoque_id: string; quantidade: string }

function parse(v: string) {
  const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v)
  return v.trim() && Number.isFinite(n) ? n : 0
}

export function RecipeDialog({ product, items, onClose }: { product: RecipeProduct | null; items: StockItem[]; onClose: () => void }) {
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] grid-cols-1 gap-5 overflow-y-auto p-6 sm:max-w-xl">
        {product && <RecipeForm key={product.id} product={product} items={items} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function RecipeForm({ product, items, onClose }: { product: RecipeProduct; items: StockItem[]; onClose: () => void }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(() =>
    product.ingredientes.length
      ? product.ingredientes.map((g) => ({ key: crypto.randomUUID(), item_estoque_id: g.item_estoque_id, quantidade: toQtyInput(g.quantidade) }))
      : [{ key: crypto.randomUUID(), item_estoque_id: "", quantidade: "" }]
  )
  const [saving, setSaving] = useState(false)
  const byId = new Map(items.map((i) => [i.id, i]))
  const usable = items.filter((i) => i.ativo)

  const cost = rows.reduce((s, r) => s + parse(r.quantidade) * (byId.get(r.item_estoque_id)?.custo_unitario ?? 0), 0)
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function save() {
    const filled = rows.filter((r) => r.item_estoque_id || r.quantidade.trim())
    if (filled.some((r) => !r.item_estoque_id)) return toast.error("Escolha o ingrediente de cada linha.")
    if (filled.some((r) => parse(r.quantidade) <= 0)) return toast.error("Informe quantidades maiores que zero.")
    setSaving(true)
    const result = await saveRecipe({ produto_id: product.id, itens: filled.map((r) => ({ item_estoque_id: r.item_estoque_id, quantidade: r.quantidade })) })
    setSaving(false)
    if (!result.ok) return toast.error(result.error)
    toast.success(filled.length ? "Ficha técnica salva." : "Ficha técnica removida.")
    onClose()
    router.refresh()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">Ficha técnica: {product.nome}</DialogTitle>
        <DialogDescription>Quanto de cada ingrediente vai em uma unidade do produto.</DialogDescription>
      </DialogHeader>

      <ul className="grid gap-2">
        {rows.map((r, i) => {
          const it = byId.get(r.item_estoque_id)
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-center gap-2">
              <NativeSelect value={r.item_estoque_id} onChange={(e) => update(r.key, { item_estoque_id: e.target.value })} aria-label={`Ingrediente ${i + 1}`} className="h-11 text-sm">
                <option value="">Escolha o ingrediente</option>
                {usable.map((u) => (
                  <option key={u.id} value={u.id} disabled={u.id !== r.item_estoque_id && rows.some((x) => x.item_estoque_id === u.id)}>
                    {u.nome} ({u.unidade})
                  </option>
                ))}
              </NativeSelect>
              <div className="relative">
                <Input
                  value={r.quantidade}
                  onChange={(e) => update(r.key, { quantidade: e.target.value })}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-11 pr-10"
                  aria-label={`Quantidade do ingrediente ${i + 1}`}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{it?.unidade}</span>
              </div>
              <Button variant="ghost" size="icon-lg" className="size-10" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remover ingrediente ${i + 1}`}>
                <X />
              </Button>
            </li>
          )
        })}
      </ul>
      <Button variant="outline" className="h-11 justify-start" onClick={() => setRows((rs) => [...rs, { key: crypto.randomUUID(), item_estoque_id: "", quantidade: "" }])} disabled={rows.length >= 50}>
        <Plus className="size-4" aria-hidden /> Adicionar ingrediente
      </Button>
      <p className="text-xs text-muted-foreground">Dica: em quilos, 150 g = 0,15 kg.</p>

      <p className="flex flex-wrap justify-between gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
        <span>
          Custo dos ingredientes: <strong className="tabular-nums">{formatCurrency(cost)}</strong>
        </span>
        <span className="text-muted-foreground">
          Preço de venda {formatCurrency(product.preco)}
          {product.preco > 0 && ` · margem ${formatCurrency(product.preco - cost)}`}
        </span>
      </p>

      <div className="flex gap-2 border-t pt-4">
        <Button type="button" variant="outline" className="h-12 flex-1" onClick={onClose}>
          Voltar
        </Button>
        <Button type="button" className="h-12 flex-[2] font-semibold" onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Salvar ficha técnica
        </Button>
      </div>
    </>
  )
}
