"use client"

import { useState } from "react"
import Link from "next/link"
import { ChefHat, CircleCheckBig, Receipt, User, Users, type LucideIcon } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { buttonVariants } from "@/components/ui/button"
import { LiveFloor } from "@/features/tables/components/live-floor"
import { TableStatusBadge } from "@/features/tables/components/table-status-badge"
import { useLiveTables } from "@/features/tables/hooks/use-live-tables"
import { formatCurrency, formatElapsed, formatTime, tableLabel } from "@/lib/format"
import { useNow } from "@/hooks/use-now"
import { cn } from "@/lib/utils"
import type { Section, TableOverview } from "@/types/domain"

export function OwnerOverview({
  restaurantId,
  tables: initial,
  sections,
}: {
  restaurantId: string
  tables: TableOverview[]
  sections: Section[]
}) {
  const { tables, state } = useLiveTables(restaurantId, initial)
  const [selected, setSelected] = useState<TableOverview | null>(null)
  const now = useNow()

  const occupied = tables.filter((t) => t.status !== "livre" && t.status !== "finalizada")
  const count = (s: TableOverview["status"]) => tables.filter((t) => t.status === s).length
  const openRevenue = occupied.reduce((sum, t) => sum + Number(t.subtotal), 0)
  const guests = occupied.reduce((sum, t) => sum + (t.pessoas ?? 0), 0)

  // mantém o painel lateral em sincronia com o tempo real
  const current = selected ? (tables.find((t) => t.id === selected.id) ?? selected) : null

  return (
    <div className="grid gap-6">
      <section aria-label="Indicadores do salão" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Mesas ocupadas" value={String(occupied.length)} hint={`${count("livre")} livres`} />
        <Kpi icon={User} label="Clientes no salão" value={String(guests)} hint={`em ${occupied.length} mesas`} />
        <Kpi icon={ChefHat} label="Mesas em preparo" value={String(count("em_preparo"))} hint={`${count("pedido_pronto")} com pedido pronto`} accent="em_preparo" />
        <Kpi icon={Receipt} label="Em aberto nas mesas" value={formatCurrency(openRevenue)} hint={`${count("aguardando_pagamento")} aguardando pagamento`} />
      </section>

      <LiveFloor tables={tables} state={state} sections={sections} onSelect={setSelected} />

      <Sheet open={!!current} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {current && (
            <>
              <SheetHeader className="border-b p-5">
                <SheetTitle className="text-2xl font-extrabold">{tableLabel(current.numero)}</SheetTitle>
                <SheetDescription>
                  {current.setor_nome ?? "Sem setor"} · {current.capacidade} lugares
                </SheetDescription>
                <TableStatusBadge status={current.status} size="lg" className="mt-2" />
              </SheetHeader>
              <div className="grid gap-4 p-5">
                {current.atendimento_id ? (
                  <dl className="grid grid-cols-2 gap-3">
                    <Info label="Garçom" value={current.garcom_nome ?? "—"} />
                    <Info label="Pessoas" value={String(current.pessoas ?? "—")} />
                    <Info label="Aberta às" value={current.aberto_em ? formatTime(current.aberto_em) : "—"} />
                    <Info label="Tempo" value={current.aberto_em ? formatElapsed(current.aberto_em, now) : "—"} />
                    <Info label="Consumo" value={formatCurrency(current.subtotal)} className="col-span-2 text-2xl" />
                  </dl>
                ) : (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CircleCheckBig className="size-5 text-status-free" aria-hidden /> Mesa livre para novos clientes.
                  </p>
                )}
                {current.atendimento_id && (
                  <Link href={`/admin/conta/${current.id}`} className={cn(buttonVariants(), "h-12 text-base font-bold")}>
                    <Receipt className="size-5" aria-hidden /> Conta e fechamento
                  </Link>
                )}
                {current.atendimento_id && (
                  <Link href="/admin/pedidos?periodo=ativos" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
                    Ver pedidos em andamento
                  </Link>
                )}
                <Link href="/admin/mesas" className={cn(buttonVariants({ variant: "ghost" }), "h-11")}>
                  Gerenciar mesas
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  accent?: "em_preparo"
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
        {label}
        <span
          className={cn(
            "grid size-9 place-items-center rounded-lg",
            accent === "em_preparo" ? "bg-status-preparing-soft text-status-preparing" : "bg-accent text-accent-foreground"
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums md:text-3xl">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("mt-0.5 font-bold", className)}>{value}</dd>
    </div>
  )
}
