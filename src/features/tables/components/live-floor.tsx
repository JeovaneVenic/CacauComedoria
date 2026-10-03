"use client"

import { useMemo, useState } from "react"
import { Radio, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNow } from "@/hooks/use-now"
import { TABLE_STATUS, TABLE_STATUS_ORDER } from "@/features/tables/status"
import type { RealtimeState } from "@/features/tables/hooks/use-live-tables"
import { TableCard } from "./table-card"
import type { Section, TableOverview, TableStatus } from "@/types/domain"

interface LiveFloorProps {
  tables: TableOverview[]
  state: RealtimeState
  sections: Section[]
  currentUserId?: string
  onSelect: (table: TableOverview) => void
  /** mostra o filtro "Minhas mesas" (garçom) */
  showMine?: boolean
}

export function LiveFloor({ tables, state, sections, currentUserId, onSelect, showMine }: LiveFloorProps) {
  const now = useNow()
  const [section, setSection] = useState<string>("all")
  const [status, setStatus] = useState<TableStatus | "all">("all")
  const [mineOnly, setMineOnly] = useState(false)

  const counts = useMemo(() => {
    const c = Object.fromEntries(TABLE_STATUS_ORDER.map((s) => [s, 0])) as Record<TableStatus, number>
    tables.forEach((t) => c[t.status]++)
    return c
  }, [tables])

  const visible = tables.filter(
    (t) =>
      (section === "all" || t.setor_id === section) &&
      (status === "all" || t.status === status) &&
      (!mineOnly || t.garcom_id === currentUserId)
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Setor" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {[{ id: "all", nome: "Todas" }, ...sections].map((s) => (
            <button
              key={s.id}
              role="tab"
              type="button"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "h-11 shrink-0 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                section === s.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.nome}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {showMine && (
            <button
              type="button"
              aria-pressed={mineOnly}
              onClick={() => setMineOnly((v) => !v)}
              className={cn(
                "h-11 rounded-lg border-2 px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                mineOnly ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              )}
            >
              Minhas mesas
            </button>
          )}
          <LiveIndicator state={state} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por estado">
        <StatusChip active={status === "all"} onClick={() => setStatus("all")} label="Todas" count={tables.length} />
        {TABLE_STATUS_ORDER.filter((s) => s !== "finalizada").map((s) => (
          <StatusChip
            key={s}
            active={status === s}
            onClick={() => setStatus(status === s ? "all" : s)}
            label={TABLE_STATUS[s].label}
            count={counts[s]}
            dot={TABLE_STATUS[s].dot}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed p-10 text-center">
          <p className="font-semibold">Nenhuma mesa encontrada.</p>
          <p className="mt-1 text-sm text-muted-foreground">Altere o setor ou o filtro de estado.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map((t) => (
            <li key={t.id} className="grid">
              <TableCard table={t} now={now} onSelect={onSelect} mine={!!currentUserId && t.garcom_id === currentUserId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  dot?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"
      )}
    >
      {dot && <span aria-hidden className={cn("size-2.5 rounded-full", dot)} />}
      {label}
      <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-background/20" : "bg-muted")}>{count}</span>
    </button>
  )
}

export function LiveIndicator({ state }: { state: RealtimeState }) {
  if (state === "offline") {
    return (
      <span role="status" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive/10 px-3 text-xs font-bold text-destructive">
        <WifiOff className="size-3.5" aria-hidden /> Reconectando…
      </span>
    )
  }
  return (
    <span
      role="status"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold",
        state === "live" ? "bg-status-free-soft text-status-free" : "bg-muted text-muted-foreground"
      )}
    >
      <Radio className={cn("size-3.5", state === "live" && "animate-pulse")} aria-hidden />
      {state === "live" ? "Ao vivo" : "Conectando…"}
    </span>
  )
}
