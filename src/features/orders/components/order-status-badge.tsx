import { cn } from "@/lib/utils"
import { ORDER_STATUS } from "@/features/orders/status"
import type { OrderStatus } from "@/types/domain"

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const s = ORDER_STATUS[status]
  const Icon = s.icon
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide uppercase [&_svg]:size-3.5",
        s.badge,
        className
      )}
    >
      <Icon aria-hidden strokeWidth={2.5} />
      {s.label}
    </span>
  )
}
