import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { getOrdersBoard, type OrderPeriod } from "@/services/orders"
import { getMenu } from "@/services/menu"
import { OrdersBoard } from "./orders-board"

export const metadata: Metadata = { title: "Pedidos" }

const PERIODS: OrderPeriod[] = ["ativos", "2h", "hoje"]

export default async function OrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  const { periodo } = await searchParams
  const period = PERIODS.includes(periodo as OrderPeriod) ? (periodo as OrderPeriod) : "hoje"
  const {
    restaurant,
    data: [orders, menu],
  } = await requireRoleWith(MANAGER_ROLES, () => Promise.all([getOrdersBoard(period), getMenu()]))

  return <OrdersBoard restaurantId={restaurant.id} orders={orders} menu={menu} period={period} />
}
