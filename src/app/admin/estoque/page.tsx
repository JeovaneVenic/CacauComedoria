import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { resolvePeriod, todaySP } from "@/lib/periods"
import { getInventory } from "@/services/inventory"
import { InventoryView } from "./inventory-view"

export const metadata: Metadata = { title: "Estoque" }

export default async function InventoryPage({ searchParams }: PageProps<"/admin/estoque">) {
  const { periodo, de, ate, aba, filtro } = await searchParams
  const period = resolvePeriod(periodo, de, ate)
  const { restaurant, data } = await requireRoleWith(MANAGER_ROLES, () => getInventory(period))

  return (
    <InventoryView
      // remonta ao trocar período ou filtro (ex.: tocar no alerta de estoque baixo estando nesta tela)
      key={`${period.inicio}:${period.fim}:${filtro ?? ""}`}
      {...data}
      period={period}
      today={todaySP()}
      autoDeduction={restaurant.baixa_estoque_automatica}
      initialTab={aba === "movimentacoes" || aba === "ficha" ? aba : "itens"}
      initialLowOnly={filtro === "baixo"}
    />
  )
}
