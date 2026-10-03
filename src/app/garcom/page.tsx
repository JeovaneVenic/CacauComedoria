import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { FLOOR_ROLES } from "@/lib/roles"
import { firstName, greeting } from "@/lib/format"
import { getSections, getTableOverview } from "@/services/tables"
import { WaiterFloor } from "./waiter-floor"

export const metadata: Metadata = { title: "Mesas" }

export default async function WaiterHomePage() {
  const {
    profile,
    restaurant,
    data: [tables, sections],
  } = await requireRoleWith(FLOOR_ROLES, () => Promise.all([getTableOverview(), getSections()]))

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {greeting()}, {firstName(profile.nome)}
        </h1>
        <p className="text-muted-foreground">Toque em uma mesa para abrir ou ver os pedidos.</p>
      </div>
      <WaiterFloor restaurantId={restaurant.id} userId={profile.id} tables={tables} sections={sections} />
    </div>
  )
}
