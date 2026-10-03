import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { requireRoleWith } from "@/lib/auth"
import { FLOOR_ROLES, isManager } from "@/lib/roles"
import { getCheckoutData } from "@/services/billing"
import { Checkout } from "@/features/billing/checkout"

export const metadata: Metadata = { title: "Conta" }

export default async function WaiterCheckoutPage({ params }: PageProps<"/garcom/mesa/[id]/conta">) {
  const { id } = await params
  const {
    profile,
    restaurant,
    data: { table, checkout },
  } = await requireRoleWith(FLOOR_ROLES, () => getCheckoutData(id))
  if (!table) notFound()
  if (!checkout) redirect(`/garcom/mesa/${id}`)

  // o RPC fechar_mesa repete esta regra no banco
  const canClose = isManager(profile.papel) || profile.papel === "caixa" || restaurant.garcom_pode_fechar_mesa

  return <Checkout mesaId={id} {...checkout} tableNumber={table.numero} canClose={canClose} backHref={`/garcom/mesa/${id}`} />
}
