"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { CloudUpload, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { useOnline } from "@/hooks/use-online"
import { pendingOrders, submitCart } from "@/features/orders/outbox"
import { tableLabel } from "@/lib/format"
import { useCartStore } from "@/stores/cart-store"

const RETRY_MS = 15_000

/** Reenvia sozinho os pedidos na fila do aparelho: ao voltar a internet, ao reabrir o app e a cada 15 s. */
export function OrderOutboxSync() {
  const router = useRouter()
  const running = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function flush() {
      if (running.current || !navigator.onLine) return
      running.current = true
      try {
        let sentAny = false
        for (const [tableId, cart] of pendingOrders(useCartStore.getState().carts)) {
          if (cancelled || !navigator.onLine) break
          const label = cart.tableNumber ? tableLabel(cart.tableNumber) : "mesa"
          const r = await submitCart(tableId)
          if (r.status === "sent") {
            sentAny = true
            toast.success(r.duplicado ? `Pedido #${r.numero} (${label}) já estava na cozinha.` : `Pedido #${r.numero} da ${label} enviado para a cozinha.`)
          } else if (r.status === "rejected") {
            toast.error(`A cozinha não aceitou o pedido da ${label}: ${r.message}`, { duration: 10_000 })
          }
        }
        if (sentAny) router.refresh()
      } finally {
        running.current = false
      }
    }

    Promise.resolve(useCartStore.persist.rehydrate()).then(flush)
    const onVisible = () => document.visibilityState === "visible" && flush()
    window.addEventListener("online", flush)
    document.addEventListener("visibilitychange", onVisible)
    const timer = setInterval(flush, RETRY_MS)
    return () => {
      cancelled = true
      window.removeEventListener("online", flush)
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(timer)
    }
  }, [router])

  return null
}

/** Faixa de conexão do garçom: sem internet e/ou pedidos aguardando envio */
export function OrderQueueBanner() {
  const online = useOnline()
  const pending = useCartStore((s) => pendingOrders(s.carts).length)

  if (online && pending === 0) return null
  const pedidos = `${pending} ${pending === 1 ? "pedido" : "pedidos"}`

  if (!online) {
    return (
      <div role="alert" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-destructive px-4 py-2.5 text-center text-sm font-bold text-white">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        {pending > 0
          ? `Sem conexão. ${pedidos} guardado${pending === 1 ? "" : "s"} no aparelho, enviado${pending === 1 ? "" : "s"} assim que a internet voltar.`
          : "Sem conexão. Você pode montar pedidos: eles serão enviados quando a internet voltar."}
      </div>
    )
  }
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-status-preparing px-4 py-2.5 text-center text-sm font-bold text-white">
      <CloudUpload className="size-4 shrink-0 animate-pulse" aria-hidden />
      Enviando {pedidos} da fila para a cozinha…
    </div>
  )
}
