import { Clock, User, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { firstName, formatCurrency, formatElapsed } from "@/lib/format"
import { TABLE_STATUS } from "@/features/tables/status"
import { TableStatusBadge } from "./table-status-badge"
import type { TableOverview } from "@/types/domain"

interface TableCardProps {
  table: TableOverview
  now: Date
  onSelect?: (table: TableOverview) => void
  /** destaca as mesas do garçom logado */
  mine?: boolean
}

/** Cartão de mesa para toque: número grande, estado com ícone e dados da sessão */
export function TableCard({ table, now, onSelect, mine }: TableCardProps) {
  const free = table.status === "livre"
  const s = TABLE_STATUS[table.status]
  const number = String(table.numero).padStart(2, "0")

  const description = [
    `Mesa ${number}`,
    s.label,
    table.garcom_nome && `garçom ${table.garcom_nome}`,
    table.pessoas && `${table.pessoas} pessoas`,
    !free && `total ${formatCurrency(table.subtotal)}`,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <button
      type="button"
      onClick={() => onSelect?.(table)}
      aria-label={description}
      className={cn(
        "group relative flex min-h-36 flex-col justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-[transform,box-shadow] outline-none",
        "hover:shadow-md focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-[0.98]",
        s.card,
        mine && !free && "shadow-[inset_0_-4px_0_0_var(--primary)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="block text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">Mesa</span>
          <span className="block text-4xl leading-none font-extrabold tracking-tight">{number}</span>
        </div>
        {!free && table.pessoas ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-sm font-semibold">
            <Users className="size-4" aria-hidden />
            {table.pessoas}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            {table.capacidade}
          </span>
        )}
      </div>

      <TableStatusBadge status={table.status} size="sm" />

      {!free && (
        <div className="grid gap-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
              <User className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{table.garcom_nome ? firstName(table.garcom_nome) : "—"}</span>
            </span>
            {table.aberto_em && (
              <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {formatElapsed(table.aberto_em, now).replace("há ", "")}
              </span>
            )}
          </div>
          <span className="text-lg font-bold">{formatCurrency(table.subtotal)}</span>
        </div>
      )}
    </button>
  )
}
