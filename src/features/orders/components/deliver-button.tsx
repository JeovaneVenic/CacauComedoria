"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HandPlatter, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { updateOrderStatus } from "@/features/orders/api"
import { cn } from "@/lib/utils"

/** Garçom confirma que levou o pedido pronto até a mesa */
export function DeliverButton({ orderId, orderNumber, className }: { orderId: string; orderNumber: number; className?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function deliver() {
    setBusy(true)
    const result = await updateOrderStatus(orderId, "entregue")
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Pedido #${orderNumber} entregue.`)
    router.refresh()
  }

  return (
    <Button onClick={deliver} disabled={busy} className={cn("h-12 text-base font-bold", className)}>
      {busy ? <Loader2 className="animate-spin" /> : <HandPlatter className="size-5" aria-hidden />}
      Marcar como entregue
    </Button>
  )
}
