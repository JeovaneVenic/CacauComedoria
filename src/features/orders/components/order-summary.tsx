"use client"

import { AlertTriangle, ChefHat, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cartTotals, type TableCart } from "@/stores/cart-store"
import { formatCurrency, tableLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

interface OrderSummaryProps {
  tableNumber: number
  waiterName: string
  cart: TableCart | undefined
  serviceFeePercent: number
  sending: boolean
  onQuantity: (lineId: string, quantity: number) => void
  onRemove: (lineId: string) => void
  onNote: (note: string) => void
  onSend: () => void
  onDiscard: () => void
  className?: string
}

/** Resumo fixo do pedido com a ação principal "ENVIAR PARA COZINHA" */
export function OrderSummary({
  tableNumber,
  waiterName,
  cart,
  serviceFeePercent,
  sending,
  onQuantity,
  onRemove,
  onNote,
  onSend,
  onDiscard,
  className,
}: OrderSummaryProps) {
  const items = cart?.items ?? []
  const locked = !!cart?.unconfirmed
  const { subtotal, service, total, count } = cartTotals(items, serviceFeePercent)

  return (
    <section aria-label="Pedido atual" className={cn("flex min-h-0 flex-col bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{tableLabel(tableNumber)}</h2>
          <p className="text-sm text-muted-foreground">Garçom: {waiterName}</p>
        </div>
        {count > 0 && (
          <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
            {count} {count === 1 ? "item" : "itens"}
          </span>
        )}
      </header>

      {locked && (
        <div role="alert" className="flex gap-2 border-b bg-status-waiting-soft p-3 text-sm font-medium text-status-waiting">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Pedido na fila de envio. Ele será enviado sozinho assim que a conexão voltar, sem duplicar. Você também pode tocar em &quot;Tentar novamente&quot;.
        </div>
      )}
      {!locked && cart?.error && (
        <div role="alert" className="flex gap-2 border-b bg-destructive/10 p-3 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          A cozinha não aceitou o pedido: {cart.error} Corrija e envie de novo.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="grid h-full min-h-40 place-items-center p-6 text-center">
            <div className="grid justify-items-center gap-2 text-muted-foreground">
              <ShoppingBag className="size-8" aria-hidden />
              <p className="font-semibold text-foreground">Nenhum item ainda</p>
              <p className="text-sm">Toque nos produtos para adicionar.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((l) => (
              <li key={l.lineId} className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="leading-snug font-bold">
                      {l.quantity}x {l.name}
                    </p>
                    {(l.optionLabels.length > 0 || l.notes) && (
                      <p className="text-sm text-muted-foreground">
                        {[...l.optionLabels, l.notes && `“${l.notes}”`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(l.unitPrice * l.quantity)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center rounded-lg border">
                    <Button
                      variant="ghost"
                      className="size-11 rounded-lg"
                      disabled={locked}
                      onClick={() => onQuantity(l.lineId, l.quantity - 1)}
                      aria-label={`Diminuir ${l.name}`}
                    >
                      <Minus className="size-5" />
                    </Button>
                    <span className="w-8 text-center text-lg font-bold tabular-nums">{l.quantity}</span>
                    <Button
                      variant="ghost"
                      className="size-11 rounded-lg"
                      disabled={locked}
                      onClick={() => onQuantity(l.lineId, l.quantity + 1)}
                      aria-label={`Aumentar ${l.name}`}
                    >
                      <Plus className="size-5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-11 text-destructive"
                    disabled={locked}
                    onClick={() => onRemove(l.lineId)}
                    aria-label={`Remover ${l.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden /> Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 && (
          <label className="grid gap-1.5 border-t p-4">
            <span className="text-sm font-semibold">Observação do pedido</span>
            <Textarea
              value={cart?.note ?? ""}
              disabled={locked}
              onChange={(e) => onNote(e.target.value)}
              placeholder="Ex.: servir as bebidas primeiro"
              rows={2}
              maxLength={200}
            />
          </label>
        )}
      </div>

      <footer className="grid gap-3 border-t p-4">
        <dl className="grid gap-1 text-base">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Serviço ({serviceFeePercent}%)</dt>
            <dd className="tabular-nums">{formatCurrency(service)}</dd>
          </div>
          <div className="flex justify-between text-xl font-extrabold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(total)}</dd>
          </div>
        </dl>
        <Button
          onClick={onSend}
          disabled={items.length === 0 || sending}
          className="h-16 text-lg font-extrabold tracking-wide uppercase shadow-lg"
        >
          {sending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ChefHat className="size-6" aria-hidden />}
          {sending ? "Enviando…" : locked ? "Tentar novamente" : "Enviar para cozinha"}
        </Button>
        {items.length > 0 && !locked && (
          <Button variant="ghost" className="h-10 text-muted-foreground" onClick={onDiscard}>
            Limpar pedido
          </Button>
        )}
      </footer>
    </section>
  )
}
