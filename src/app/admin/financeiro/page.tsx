import type { Metadata } from "next"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { resolvePeriod, todaySP } from "@/lib/periods"
import { getFinance } from "@/services/finance"
import { FinanceView } from "./finance-view"

export const metadata: Metadata = { title: "Financeiro" }

export default async function FinancePage({ searchParams }: PageProps<"/admin/financeiro">) {
  const { periodo, de, ate } = await searchParams
  const period = resolvePeriod(periodo, de, ate)
  const { restaurant, data } = await requireRoleWith(MANAGER_ROLES, () => getFinance(period))

  return <FinanceView restaurantId={restaurant.id} period={period} today={todaySP()} {...data} />
}
