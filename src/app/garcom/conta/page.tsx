import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Receipt, Users } from "lucide-react"
import { requireRoleWith } from "@/lib/auth"
import { FLOOR_ROLES } from "@/lib/roles"
import { formatCurrency, formatElapsed, tableLabel } from "@/lib/format"
import { getTableOverview } from "@/services/tables"
import { TableStatusBadge } from "@/features/tables/components/table-status-badge"
import { LiveRefresh } from "../live-refresh"

export const metadata: Metadata = { title: "Contas" }

export default async function WaiterBillsPage() {
  const { profile, restaurant, data: all } = await requireRoleWith(FLOOR_ROLES, getTableOverview)
  // mesas abertas pelo garçom; quem pediu a conta aparece primeiro
  const mine = all
    .filter((t) => t.atendimento_id && t.garcom_id === profile.id)
    .sort((a, b) => Number(b.status === "aguardando_pagamento") - Number(a.status === "aguardando_pagamento") || a.numero - b.numero)
  const fee = Number(restaurant.taxa_servico_percentual)

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <LiveRefresh channel={`garcom-contas:${profile.id}`} restaurantId={restaurant.id} tables={["mesas", "atendimentos", "pedidos"]} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Contas</h1>
        <p className="text-muted-foreground">Suas mesas abertas. Toque para pedir ou fechar a conta.</p>
      </div>

      {mine.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
          <Receipt className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">Nenhuma mesa ocupada.</p>
          <Link href="/garcom" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Ir para as mesas
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {mine.map((t) => {
            const total = Math.round(t.subtotal * (100 + fee)) / 100
            return (
              <li key={t.id}>
                <Link
                  href={`/garcom/mesa/${t.id}/conta`}
                  className="flex items-center gap-4 rounded-2xl border bg-card p-4 outline-none hover:bg-muted/50 focus-visible:ring-4 focus-visible:ring-ring/50"
                >
                  <div className="grid flex-1 gap-1.5">
                    <span className="text-xl font-extrabold">{tableLabel(t.numero)}</span>
                    <TableStatusBadge status={t.status} size="sm" />
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="size-4" aria-hidden /> {t.pessoas} · aberta {t.aberto_em ? formatElapsed(t.aberto_em) : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-muted-foreground">com serviço</span>
                    <span className="text-xl font-extrabold tabular-nums">{formatCurrency(total)}</span>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
