import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"
import { requireRoleWith } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { PageHeader } from "@/components/layout/page-header"
import { getSections, getTableOverview } from "@/services/tables"
import { getDashboard } from "@/services/dashboard"
import { OwnerOverview } from "./owner-overview"
import { DashboardMetrics } from "./dashboard-metrics"

export const metadata: Metadata = { title: "Visão geral" }

const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })

export default async function AdminHomePage() {
  const {
    restaurant,
    data: [tables, sections, dashboard],
  } = await requireRoleWith(MANAGER_ROLES, () => Promise.all([getTableOverview(), getSections(), getDashboard()]))
  const today = longDate.format(new Date())

  return (
    <div className="mx-auto grid max-w-7xl gap-8">
      <div>
        <PageHeader title="Visão geral" description={today.charAt(0).toUpperCase() + today.slice(1)} />
        {dashboard ? (
          <DashboardMetrics restaurantId={restaurant.id} data={dashboard} />
        ) : (
          <p role="alert" className="flex gap-2 rounded-xl border border-status-preparing/40 bg-status-preparing-soft p-4 text-sm font-medium text-status-preparing">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            Os indicadores financeiros precisam de uma atualização no banco: rode o arquivo
            supabase/migrations/20261002000006_dashboard.sql no SQL Editor do Supabase.
          </p>
        )}
      </div>

      <section aria-labelledby="salao-agora" className="grid gap-4">
        <h2 id="salao-agora" className="text-xl font-extrabold tracking-tight">
          Salão agora
        </h2>
        <OwnerOverview restaurantId={restaurant.id} tables={tables} sections={sections} />
      </section>
    </div>
  )
}
