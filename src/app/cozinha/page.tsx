import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { KITCHEN_ROLES, isManager } from "@/lib/roles"
import { getKitchenOrders } from "@/services/orders"
import { KitchenDisplay } from "./kitchen-display"

export const metadata: Metadata = { title: "Cozinha" }

export default async function KitchenPage() {
  const { profile, restaurant, data: orders } = await requireRoleWith(KITCHEN_ROLES, getKitchenOrders)

  return (
    <KitchenDisplay
      restaurantId={restaurant.id}
      restaurantName={restaurant.nome}
      userName={profile.nome}
      canManage={isManager(profile.papel)}
      orders={orders}
    />
  )
}
