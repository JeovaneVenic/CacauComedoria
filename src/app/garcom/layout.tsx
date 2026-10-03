import { requireRole } from "@/lib/auth"
import { FLOOR_ROLES } from "@/lib/roles"
import { OrderOutboxSync, OrderQueueBanner } from "@/features/orders/components/order-outbox"
import { LogoMark } from "@/components/brand/logo"
import { WaiterNav } from "./waiter-nav"
import { NotificationBell, NotificationsProvider } from "@/features/notifications/notification-bell"

export default async function WaiterLayout({ children }: LayoutProps<"/garcom">) {
  const { profile, restaurant } = await requireRole(FLOOR_ROLES)

  return (
    <NotificationsProvider restaurantId={restaurant.id} role={profile.papel}>
    <div className="flex min-h-dvh flex-col">
      <OrderOutboxSync />
      <OrderQueueBanner />
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
        <LogoMark className="size-8" />
        <span className="truncate font-bold">{restaurant.nome}</span>
        <NotificationBell className="ml-auto" />
      </header>
      {/* espaço para a navegação inferior + área segura do tablet */}
      <main className="flex-1 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6">{children}</main>
      <WaiterNav />
    </div>
    </NotificationsProvider>
  )
}
