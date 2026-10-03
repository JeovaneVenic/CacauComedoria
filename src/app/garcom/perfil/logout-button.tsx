"use client"

import { useRef, useState } from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/feedback/confirm-dialog"
import { pendingOrders } from "@/features/orders/outbox"
import { useCartStore } from "@/stores/cart-store"

/** Sair, avisando antes se ainda há pedidos na fila deste aparelho */
export function LogoutButton() {
  const formRef = useRef<HTMLFormElement>(null)
  const pending = useCartStore((s) => pendingOrders(s.carts).length)
  const [confirm, setConfirm] = useState(false)

  return (
    <form
      ref={formRef}
      action="/auth/sair"
      method="post"
      onSubmit={(e) => {
        if (pending > 0) {
          e.preventDefault()
          setConfirm(true)
        }
      }}
    >
      <Button type="submit" variant="outline" className="h-14 w-full text-base font-semibold">
        <LogOut className="size-5" aria-hidden /> Sair
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Ainda há ${pending} ${pending === 1 ? "pedido" : "pedidos"} na fila`}
        description="Eles ainda não chegaram à cozinha. Se sair agora, só serão enviados quando alguém entrar de novo neste aparelho com internet."
        confirmLabel="Sair mesmo assim"
        onConfirm={() => {
          setConfirm(false)
          formRef.current?.submit()
        }}
      />
    </form>
  )
}
