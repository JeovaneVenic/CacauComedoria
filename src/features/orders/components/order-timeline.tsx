import { Check } from "lucide-react"
import { formatDuration, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { OrderRow } from "@/services/orders"

/** Horário de cada etapa do pedido (vem dos carimbos gravados pelo banco) */
export function OrderTimeline({ order }: { order: OrderRow }) {
  const steps = [
    { label: "Criado", at: order.criado_em },
    { label: "Enviado para cozinha", at: order.enviado_em },
    { label: "Início do preparo", at: order.preparo_iniciado_em },
    { label: "Pronto", at: order.pronto_em },
    { label: "Entregue", at: order.entregue_em },
    { label: "Finalizado", at: order.finalizado_em },
  ]
  if (order.cancelado_em) steps.push({ label: order.status === "devolvido" ? "Devolvido" : "Cancelado", at: order.cancelado_em })

  const prep = order.preparo_iniciado_em && order.pronto_em ? formatDuration(order.preparo_iniciado_em, order.pronto_em) : null

  return (
    <div className="grid gap-2">
      <ol className="grid gap-0">
        {steps.map((s, i) => {
          const done = !!s.at
          const cancel = s.label === "Cancelado" || s.label === "Devolvido"
          return (
            <li key={s.label} className="relative flex items-center gap-3 py-1.5">
              {i < steps.length - 1 && (
                <span aria-hidden className={cn("absolute top-6 left-[0.6rem] h-[calc(100%-0.75rem)] w-0.5", done ? "bg-primary/40" : "bg-border")} />
              )}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 grid size-5 shrink-0 place-items-center rounded-full border-2",
                  done ? (cancel ? "border-destructive bg-destructive text-white" : "border-primary bg-primary text-primary-foreground") : "border-border bg-card"
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cn("flex-1 text-sm", done ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{s.at ? formatTime(s.at) : "—"}</span>
            </li>
          )
        })}
      </ol>
      {prep && <p className="text-sm text-muted-foreground">Tempo de preparo: <strong className="text-foreground">{prep}</strong></p>}
    </div>
  )
}
