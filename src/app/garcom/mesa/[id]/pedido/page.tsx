import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireRoleWith } from "@/lib/auth"
import { FLOOR_ROLES } from "@/lib/roles"
import { getTableWithSession } from "@/services/tables"
import { getMenu } from "@/services/menu"
import { OrderBuilder } from "./order-builder"

export const metadata: Metadata = { title: "Novo pedido" }

export default async function NewOrderPage({ params }: PageProps<"/garcom/mesa/[id]/pedido">) {
  const { id } = await params
  const {
    profile,
    restaurant,
    data: [table, menu],
  } = await requireRoleWith(FLOOR_ROLES, () => Promise.all([getTableWithSession(id), getMenu()]))
  if (!table) notFound()

  // o garçom só vê categorias ativas; produtos pausados aparecem como indisponíveis
  const categories = menu.categories.filter((c) => c.ativa)
  const categoryIds = new Set(categories.map((c) => c.id))

  return (
    <OrderBuilder
      table={table}
      waiterName={table.garcom_nome ?? profile.nome}
      serviceFeePercent={Number(restaurant.taxa_servico_percentual)}
      categories={categories}
      products={menu.products.filter((p) => categoryIds.has(p.categoria_id))}
      groups={menu.groups}
      links={menu.links}
    />
  )
}
