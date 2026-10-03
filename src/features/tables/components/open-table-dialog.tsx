"use client"

import { useState } from "react"
import { Loader2, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { tableLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TableOverview } from "@/types/domain"

interface OpenTableDialogProps {
  table: TableOverview | null
  onOpenChange: (open: boolean) => void
  onConfirm: (table: TableOverview, guests: number) => Promise<void>
}

const QUICK_GUESTS = [1, 2, 3, 4, 5, 6]

/** Abrir mesa em dois toques: quantidade de pessoas + confirmar */
export function OpenTableDialog({ table, onOpenChange, onConfirm }: OpenTableDialogProps) {
  const [guests, setGuests] = useState(2)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!table) return
    setBusy(true)
    try {
      await onConfirm(table, guests)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={!!table}
      onOpenChange={(open) => {
        if (open && table) setGuests(Math.min(2, table.capacidade))
        onOpenChange(open)
      }}
    >
      <DialogContent className="gap-6 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{table ? `Abrir ${tableLabel(table.numero)}` : "Abrir mesa"}</DialogTitle>
          <DialogDescription className="text-base">Quantas pessoas estão na mesa?</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Quantidade de pessoas" className="grid grid-cols-3 gap-2">
          {QUICK_GUESTS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={guests === n}
              onClick={() => setGuests(n)}
              className={cn(
                "h-16 rounded-xl border-2 text-2xl font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                guests === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-2">
          <Button
            type="button"
            variant="outline"
            className="size-14 rounded-lg"
            onClick={() => setGuests((g) => Math.max(1, g - 1))}
            aria-label="Diminuir pessoas"
          >
            <Minus className="size-6" />
          </Button>
          <output aria-live="polite" className="text-center">
            <span className="block text-3xl font-extrabold">{guests}</span>
            <span className="text-sm text-muted-foreground">{guests === 1 ? "pessoa" : "pessoas"}</span>
          </output>
          <Button
            type="button"
            variant="outline"
            className="size-14 rounded-lg"
            onClick={() => setGuests((g) => Math.min(30, g + 1))}
            aria-label="Aumentar pessoas"
          >
            <Plus className="size-6" />
          </Button>
        </div>

        <DialogFooter className="-mx-6 -mb-6 p-4 sm:flex-row">
          <Button variant="outline" className="h-14 flex-1 text-base" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button className="h-14 flex-[2] text-base font-bold" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Abrir mesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
