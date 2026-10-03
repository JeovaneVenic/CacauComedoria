"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2, Plus, Undo2, User, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ReasonDialog } from "@/components/feedback/reason-dialog"
import { OrderStatusBadge } from "./order-status-badge"
import { OrderTimeline } from "./order-timeline"
import { AddItemsDialog } from "./add-items-dialog"
import { CANCELABLE, EDITABLE, ORDER_NEXT, RETURNABLE } from "@/features/orders/status"
import { cancelOrderItem, updateOrderStatus } from "@/features/orders/api"
import { formatCurrency, formatDuration, tableLabel } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MenuData } from "@/services/menu"
import type { OrderItem, OrderRow } from "@/services/orders"
import type { OrderStatus } from "@/types/domain"

interface OrderDetailSheetProps {
  order: OrderRow | null
  menu: MenuData
  onClose: () => void
}

export function OrderDetailSheet({ order, menu, onClose }: OrderDetailSheetProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const [cancelling, setCancelling] = useState<"pedido" | "devolver" | OrderItem | null>(null)
  const [adding, setAdding] = useState(false)

  async function move(to: OrderStatus, motivo?: string) {
    if (!order) return false
    setBusy(to)
    const result = await updateOrderStatus(order.id, to, motivo)
    setBusy(null)
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    toast.success(`Pedido #${order.numero} atualizado.`)
    router.refresh()
    return true
  }

  async function confirmCancel(reason: string) {
    if (!order || !cancelling) return false
    let ok: boolean
    if (cancelling === "pedido") ok = await move("cancelado", reason)
    else if (cancelling === "devolver") ok = await move("devolvido", reason)
    else {
      const result = await cancelOrderItem(cancelling.id, reason)
      ok = result.ok
      if (!result.ok) toast.error(result.error)
      else {
        toast.success(`${cancelling.produto_nome} cancelado no pedido #${order.numero}.`)
        router.refresh()
      }
    }
    if (ok) setCancelling(null)
    return ok
  }

  const editable = !!order && EDITABLE.includes(order.status)
  const activeItems = order?.itens_pedido.filter((i) => !i.cancelado) ?? []

  return (
    <>
      <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {order && (
            <>
              <SheetHeader className="border-b p-5">
                <SheetTitle className="text-2xl font-extrabold">
                  Pedido #{order.numero} · {order.mesa ? tableLabel(order.mesa.numero) : "Mesa"}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <User className="size-4" aria-hidden /> {order.garcom?.nome ?? "—"}
                  </span>
                  <span>Há {formatDuration(order.enviado_em ?? order.criado_em)}</span>
                </SheetDescription>
                <OrderStatusBadge status={order.status} className="mt-1" />
                {order.motivo_cancelamento && (
                  <p className="mt-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Motivo: {order.motivo_cancelamento}</p>
                )}
              </SheetHeader>

              {/* próximos passos */}
              {(ORDER_NEXT[order.status]?.length ?? 0) > 0 && (
                <div className="grid gap-2 border-b p-5">
                  {ORDER_NEXT[order.status]!.map((a) => (
                    <Button
                      key={a.to}
                      variant={a.primary ? "default" : "outline"}
                      className={cn("h-12 text-base", a.primary && "font-bold")}
                      disabled={!!busy}
                      onClick={() => move(a.to)}
                    >
                      {busy === a.to ? <Loader2 className="animate-spin" /> : <a.icon className="size-5" aria-hidden />}
                      {a.label}
                    </Button>
                  ))}
                </div>
              )}

              <section aria-labelledby="itens" className="grid gap-3 border-b p-5">
                <div className="flex items-center justify-between">
                  <h3 id="itens" className="font-bold">
                    Itens
                  </h3>
                  {editable && (
                    <Button variant="outline" className="h-10" onClick={() => setAdding(true)}>
                      <Plus className="size-4" aria-hidden /> Adicionar itens
                    </Button>
                  )}
                </div>
                <ul className="grid gap-3">
                  {order.itens_pedido.map((i) => (
                    <li key={i.id} className={cn("flex items-start gap-3", i.cancelado && "text-muted-foreground")}>
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-semibold", i.cancelado && "line-through")}>
                          {i.quantidade}x {i.produto_nome}
                        </p>
                        {(i.itens_pedido_opcoes.length > 0 || i.observacao) && (
                          <p className="text-sm text-muted-foreground">
                            {[...i.itens_pedido_opcoes.map((m) => m.opcao_nome), i.observacao && `“${i.observacao}”`].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {i.cancelado && <p className="text-xs font-bold text-destructive uppercase">Cancelado</p>}
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(i.quantidade * i.preco_unitario)}</span>
                      {editable && !i.cancelado && activeItems.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          className="-my-1 size-9 text-destructive"
                          onClick={() => setCancelling(i)}
                          aria-label={`Cancelar ${i.produto_nome}`}
                        >
                          <X />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {order.observacao && <p className="rounded-lg bg-muted px-3 py-2 text-sm">Observação: {order.observacao}</p>}
                <div className="flex justify-between border-t pt-3 text-lg font-extrabold">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                </div>
              </section>

              <section aria-labelledby="linha-tempo" className="grid gap-3 border-b p-5">
                <h3 id="linha-tempo" className="font-bold">
                  Linha do tempo
                </h3>
                <OrderTimeline order={order} />
              </section>

              {(CANCELABLE.includes(order.status) || RETURNABLE.includes(order.status)) && (
                <div className="grid gap-2 p-5">
                  {CANCELABLE.includes(order.status) && (
                    <Button variant="destructive" className="h-12" onClick={() => setCancelling("pedido")}>
                      <Ban className="size-4" aria-hidden /> Cancelar pedido
                    </Button>
                  )}
                  {RETURNABLE.includes(order.status) && (
                    <Button variant="destructive" className="h-12" onClick={() => setCancelling("devolver")}>
                      <Undo2 className="size-4" aria-hidden /> Registrar devolução
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={
          cancelling === "pedido"
            ? "Tem certeza que deseja cancelar este pedido?"
            : cancelling === "devolver"
              ? "Registrar devolução deste pedido?"
              : `Cancelar ${typeof cancelling === "object" && cancelling ? cancelling.produto_nome : "item"}?`
        }
        description={
          cancelling === "pedido" || cancelling === "devolver"
            ? "O valor sai da conta da mesa e a ação fica registrada na auditoria."
            : "O item sai da conta e a cozinha verá como cancelado."
        }
        onConfirm={confirmCancel}
      />

      {order && (
        <AddItemsDialog
          open={adding}
          onOpenChange={setAdding}
          orderId={order.id}
          orderNumber={order.numero}
          menu={menu}
          onDone={() => router.refresh()}
        />
      )}
    </>
  )
}
