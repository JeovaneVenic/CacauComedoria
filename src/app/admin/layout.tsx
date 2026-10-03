import { requireRole } from "@/lib/auth"
import { MANAGER_ROLES } from "@/lib/roles"
import { ConnectionBanner } from "@/components/layout/connection-banner"
import { AdminMobileHeader, AdminSidebar } from "./admin-nav"
import { NotificationsProvider } from "@/features/notifications/notification-bell"

// Toda a área /admin é bloqueada no servidor para quem não é gestão
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile, restaurant } = await requireRole(MANAGER_ROLES)
  const nav = { restaurantName: restaurant.nome, userName: profile.nome }

  return (
    <NotificationsProvider restaurantId={restaurant.id} role={profile.papel}>
    <div className="flex min-h-dvh">
      <AdminSidebar {...nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />
        <AdminMobileHeader {...nav} />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
    </NotificationsProvider>
  )
}
