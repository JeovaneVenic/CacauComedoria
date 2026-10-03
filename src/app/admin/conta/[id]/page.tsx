import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { getCheckoutData } from "@/services/billing"
import { Checkout } from "@/features/billing/checkout"

export const metadata: Metadata = { title: "Conta" }

export default async function AdminCheckoutPage({ params }: PageProps<"/admin/conta/[id]">) {
  const { id } = await params
  const {
    data: { table, checkout },
  } = await requireRoleWith(MANAGER_ROLES, () => getCheckoutData(id))
  if (!table) notFound()
  if (!checkout) redirect("/admin")

  return <Checkout {...checkout} tableNumber={table.numero} canClose backHref="/admin" />
}
