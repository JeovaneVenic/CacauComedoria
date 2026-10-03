"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/features/notifications/notification-bell"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** fase em que o módulo será liberado */
  phase?: number
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/mesas", label: "Mesas", icon: LayoutGrid },
  { href: "/admin/cardapio", label: "Cardápio", icon: BookOpen },
  { href: "/cozinha", label: "Cozinha", icon: ChefHat },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/estoque", label: "Estoque", icon: Package },
  { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <ul className="grid gap-0.5">
      {NAV.map(({ href, label, icon: Icon, phase }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
        if (phase) {
          return (
            <li key={href}>
              <span
                aria-disabled="true"
                className="flex h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/45"
              >
                <Icon className="size-5" aria-hidden />
                {label}
                <span className="ml-auto rounded-full border border-sidebar-border px-2 py-0.5 text-[0.65rem] font-semibold">
                  Fase {phase}
                </span>
              </span>
            </li>
          )
        }
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function SidebarBody({ restaurantName, userName, onNavigate }: { restaurantName: string; userName: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-3 px-1 pt-1">
        <LogoMark className="size-9" />
        <span className="flex-1 leading-tight font-bold">{restaurantName}</span>
        <NotificationBell variant="sidebar" className="-mr-1 hidden lg:inline-flex" />
      </div>
      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto">
        <NavList onNavigate={onNavigate} />
      </nav>
      <div className="grid gap-2 border-t border-sidebar-border pt-4">
        <p className="truncate px-1 text-sm text-muted-foreground">{userName}</p>
        <form action="/auth/sair" method="post">
          <button
            type="submit"
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/85 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            <LogOut className="size-5" aria-hidden /> Sair
          </button>
        </form>
      </div>
    </div>
  )
}

export function AdminSidebar(props: { restaurantName: string; userName: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-sidebar text-sidebar-foreground lg:block">
      <SidebarBody {...props} />
    </aside>
  )
}

export function AdminMobileHeader(props: { restaurantName: string; userName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <Button variant="ghost" size="icon-lg" onClick={() => setOpen(true)} aria-label="Abrir menu">
        <Menu className="size-6" />
      </Button>
      <span className="flex-1 truncate font-bold">{props.restaurantName}</span>
      <NotificationBell />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarBody {...props} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
