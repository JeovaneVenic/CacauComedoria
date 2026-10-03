import type { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { PageHeader } from "@/components/layout/page-header"
import { InstallAppCard } from "@/components/pwa/install-app"
import { SettingsForm } from "./settings-form"

export const metadata: Metadata = { title: "Configurações" }

export default async function SettingsPage() {
  const { restaurant } = await requireRole(MANAGER_ROLES)
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Configurações" description="Dados do restaurante, taxa de serviço e horário de funcionamento." />
      <div className="grid gap-6">
        <SettingsForm restaurant={restaurant} />
        <InstallAppCard />
      </div>
    </div>
  )
}
