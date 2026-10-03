import { cn } from "@/lib/utils"
import { TABLE_STATUS } from "@/features/tables/status"
import type { TableStatus } from "@/types/domain"

export function TableStatusBadge({
  status,
  size = "md",
  className,
}: {
  status: TableStatus
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const s = TABLE_STATUS[status]
  const Icon = s.icon
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full font-bold tracking-wide uppercase",
        size === "sm" && "px-2 py-0.5 text-[0.68rem] [&_svg]:size-3",
        size === "md" && "px-2.5 py-1 text-xs [&_svg]:size-3.5",
        size === "lg" && "px-3 py-1.5 text-sm [&_svg]:size-4",
        s.badge,
        className
      )}
    >
      <Icon aria-hidden strokeWidth={2.5} />
      {s.label}
    </span>
  )
}
