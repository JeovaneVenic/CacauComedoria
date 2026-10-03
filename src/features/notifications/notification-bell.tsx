"use client"

import { createContext, useContext, useState } from "react"
import Link from "next/link"
import { Bell, BellRing, Package, Receipt, Wallet, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useNow } from "@/hooks/use-now"
import { formatElapsed } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AppRole } from "@/types/domain"
import { useNotifications, type AppNotification } from "./use-notifications"

type NotificationsState = ReturnType<typeof useNotifications> & { role: AppRole }
const NotificationsContext = createContext<NotificationsState | null>(null)

/** Uma única assinatura por tela: vários sinos (menu lateral e topo) compartilham os avisos */
export function NotificationsProvider({ restaurantId, role, children }: { restaurantId: string; role: AppRole; children: React.ReactNode }) {
  const state = useNotifications(restaurantId, role)
  return <NotificationsContext.Provider value={{ ...state, role }}>{children}</NotificationsContext.Provider>
}

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  "pedido.pronto": { icon: BellRing, tone: "bg-status-ready-soft text-status-ready" },
  "mesa.conta_solicitada": { icon: Receipt, tone: "bg-status-payment-soft text-status-payment" },
  "estoque.baixo": { icon: Package, tone: "bg-status-preparing-soft text-status-preparing" },
  "despesa.nova": { icon: Wallet, tone: "bg-muted text-muted-foreground" },
}

/** Para onde levar ao tocar na notificação */
function hrefFor(n: AppNotification, isManager: boolean) {
  const mesa = n.dados?.mesa_id
  if (n.tipo === "pedido.pronto" && mesa) return `/garcom/mesa/${mesa}`
  if (n.tipo === "mesa.conta_solicitada" && mesa) return isManager ? `/admin/conta/${mesa}` : `/garcom/mesa/${mesa}/conta`
  if (n.tipo === "estoque.baixo" && isManager) return "/admin/estoque?filtro=baixo"
  if (n.tipo === "despesa.nova" && isManager) return "/admin/financeiro"
  return null
}

export function NotificationBell({ className, variant = "light" }: { className?: string; variant?: "light" | "sidebar" }) {
  const ctx = useContext(NotificationsContext)
  const [open, setOpen] = useState(false)
  const now = useNow(60_000)
  if (!ctx) throw new Error("NotificationBell precisa de NotificationsProvider")
  const { items, unread, markAllRead, role } = ctx
  const isManager = role === "proprietario" || role === "gerente" || role === "administrador"

  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        className={cn("relative size-11", variant === "sidebar" && "text-sidebar-foreground hover:bg-sidebar-accent", className)}
        onClick={() => setOpen(true)}
        aria-label={unread.length ? `Notificações: ${unread.length} não lidas` : "Notificações"}
      >
        <Bell className="size-5" aria-hidden />
        {unread.length > 0 && (
          <span className="absolute top-1.5 right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.7rem] font-bold text-primary-foreground">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </Button>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) markAllRead()
        }}
      >
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="text-xl font-extrabold">Notificações</SheetTitle>
            <SheetDescription>{unread.length ? `${unread.length} não lidas` : "Tudo em dia."}</SheetDescription>
          </SheetHeader>
          {items.length === 0 ? (
            <div className="grid place-items-center gap-2 p-10 text-center text-muted-foreground">
              <Bell className="size-8" aria-hidden />
              <p className="font-semibold text-foreground">Nenhuma notificação por enquanto.</p>
              <p className="text-sm">Pedidos prontos e contas solicitadas aparecem aqui.</p>
            </div>
          ) : (
            <ul className="divide-y overflow-y-auto">
              {items.map((n) => {
                const style = ICONS[n.tipo] ?? ICONS["despesa.nova"]
                const href = hrefFor(n, isManager)
                const body = (
                  <div className={cn("flex gap-3 p-4", !n.lida_em && "bg-accent/50")}>
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", style.tone)}>
                      <style.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{n.titulo}</span>
                      {n.mensagem && <span className="block text-sm text-muted-foreground">{n.mensagem}</span>}
                      <span className="text-xs text-muted-foreground">{formatElapsed(n.criado_em, now)}</span>
                    </span>
                    {!n.lida_em && <span aria-label="Não lida" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                )
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link href={href} onClick={() => setOpen(false)} className="block outline-none hover:bg-muted/60 focus-visible:bg-muted">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
