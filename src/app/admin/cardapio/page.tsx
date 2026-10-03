import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { getMenu } from "@/services/menu"
import { MenuManager } from "./menu-manager"

export const metadata: Metadata = { title: "Cardápio" }

export default async function MenuPage() {
  const { restaurant, data: menu } = await requireRoleWith(MANAGER_ROLES, getMenu)
  return <MenuManager restaurantId={restaurant.id} {...menu} />
}
