"use client"

import { useState } from "react"
import Image from "next/image"
import { Check, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ModifierGroup, Product } from "@/types/domain"

export interface ModifierChoice {
  optionIds: string[]
  optionLabels: string[]
  unitPrice: number
  quantity: number
  notes: string
}

interface ModifierDialogProps {
  product: Product | null
  groups: ModifierGroup[]
  onClose: () => void
  onConfirm: (product: Product, choice: ModifierChoice) => void
}

/** Personalização do item: ponto, adicionais, observação e quantidade */
export function ModifierDialog({ product, groups, onClose, onConfirm }: ModifierDialogProps) {
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] grid-cols-1 gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {/* key reinicia as escolhas a cada produto */}
        {product && <ModifierForm key={product.id} product={product} groups={groups} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  )
}

function ModifierForm({
  product,
  groups,
  onConfirm,
}: {
  product: Product
  groups: ModifierGroup[]
  onConfirm: ModifierDialogProps["onConfirm"]
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState("")
  const [showErrors, setShowErrors] = useState(false)

  const activeOptions = (g: ModifierGroup) => g.opcoes.filter((o) => o.ativa)
  const missing = groups.filter((g) => (selected[g.id]?.length ?? 0) < g.min_escolhas)
  const extras = groups.flatMap((g) => activeOptions(g).filter((o) => selected[g.id]?.includes(o.id)))
  const unitPrice = Math.round((product.preco + extras.reduce((s, o) => s + o.acrescimo, 0)) * 100) / 100

  function toggle(group: ModifierGroup, optionId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? []
      if (group.max_escolhas === 1) return { ...prev, [group.id]: current[0] === optionId && group.min_escolhas === 0 ? [] : [optionId] }
      if (current.includes(optionId)) return { ...prev, [group.id]: current.filter((id) => id !== optionId) }
      if (current.length >= group.max_escolhas) return prev
      return { ...prev, [group.id]: [...current, optionId] }
    })
  }

  function confirm() {
    if (missing.length) {
      setShowErrors(true)
      document.getElementById(`grupo-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    // ordem das opções segue a ordem dos grupos (ex.: "Ao ponto · Bacon")
    onConfirm(product, {
      optionIds: extras.map((o) => o.id),
      optionLabels: extras.map((o) => o.nome),
      unitPrice,
      quantity,
      notes: notes.trim(),
    })
  }

  return (
    <>
      {product.imagem_url && (
        <div className="relative aspect-[16/7] w-full bg-muted">
          <Image src={product.imagem_url} alt="" fill sizes="32rem" className="object-cover" />
        </div>
      )}
      <DialogHeader className="p-5 pb-3">
        <DialogTitle className="text-2xl font-extrabold">{product.nome}</DialogTitle>
        <DialogDescription className="text-base">
          {product.descricao ? `${product.descricao} · ` : ""}
          {formatCurrency(product.preco)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 px-5 pb-5">
        {groups.map((g) => {
          const chosen = selected[g.id] ?? []
          const invalid = showErrors && chosen.length < g.min_escolhas
          const single = g.max_escolhas === 1
          return (
            <fieldset key={g.id} id={`grupo-${g.id}`} className="grid gap-2">
              <legend className="mb-2 flex w-full items-center justify-between gap-2">
                <span className="text-lg font-bold">{g.nome}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold uppercase",
                    invalid
                      ? "bg-destructive text-white"
                      : g.min_escolhas > 0
                        ? "bg-status-waiting-soft text-status-waiting"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {g.min_escolhas > 0 ? (single ? "Escolha 1" : `Escolha ${g.min_escolhas}+`) : single ? "Opcional" : `Até ${g.max_escolhas}`}
                </span>
              </legend>
              <div role={single ? "radiogroup" : "group"} aria-label={g.nome} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {activeOptions(g).map((o) => {
                  const on = chosen.includes(o.id)
                  const blocked = !on && !single && chosen.length >= g.max_escolhas
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role={single ? "radio" : "checkbox"}
                      aria-checked={on}
                      disabled={blocked}
                      onClick={() => toggle(g, o.id)}
                      className={cn(
                        "relative flex min-h-16 flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:opacity-40",
                        on ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted",
                        invalid && !on && "border-destructive/50"
                      )}
                    >
                      <span className="pr-6 leading-tight font-semibold">{o.nome}</span>
                      {o.acrescimo > 0 && <span className="text-sm text-muted-foreground">+ {formatCurrency(o.acrescimo)}</span>}
                      {on && (
                        <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" strokeWidth={3} aria-hidden />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {invalid && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                  Escolha {g.nome.toLowerCase()} para continuar.
                </p>
              )}
            </fieldset>
          )
        })}

        <label className="grid gap-2">
          <span className="text-lg font-bold">Observações</span>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Digite uma observação (ex.: sem cebola)"
            rows={2}
            maxLength={140}
            className="text-base"
          />
        </label>
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 border-t bg-popover p-4">
        <div className="flex items-center rounded-xl border">
          <Button
            type="button"
            variant="ghost"
            className="size-14 rounded-xl"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Diminuir quantidade"
          >
            <Minus className="size-6" />
          </Button>
          <output aria-live="polite" aria-label="Quantidade" className="w-10 text-center text-2xl font-extrabold">
            {quantity}
          </output>
          <Button
            type="button"
            variant="ghost"
            className="size-14 rounded-xl"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            aria-label="Aumentar quantidade"
          >
            <Plus className="size-6" />
          </Button>
        </div>
        <Button type="button" onClick={confirm} className="h-14 flex-1 text-base font-bold">
          Adicionar ao pedido · {formatCurrency(unitPrice * quantity)}
        </Button>
      </div>
    </>
  )
}
