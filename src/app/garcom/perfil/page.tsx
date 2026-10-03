import type { Metadata } from "next"
import { InstallAppCard } from "@/components/pwa/install-app"
import { LogoutButton } from "./logout-button"
import { requireRole } from "@/lib/auth"
import { FLOOR_ROLES, ROLE_LABELS } from "@/lib/roles"

export const metadata: Metadata = { title: "Perfil" }

export default async function WaiterProfilePage() {
  const { profile, restaurant } = await requireRole(FLOOR_ROLES)
  const initials = profile.nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()

  return (
    <div className="mx-auto grid max-w-md gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Perfil</h1>
      <section className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <span aria-hidden className="grid size-16 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{profile.nome}</p>
          <p className="text-muted-foreground">
            {ROLE_LABELS[profile.papel]} · {restaurant.nome}
          </p>
          {profile.email && <p className="truncate text-sm text-muted-foreground">{profile.email}</p>}
        </div>
      </section>
      <InstallAppCard />
      <LogoutButton />
    </div>
  )
}
