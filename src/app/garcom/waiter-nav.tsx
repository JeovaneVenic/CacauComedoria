"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, LayoutGrid, Receipt, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  {
    href: "/garcom",
    label: "Mesas",
    icon: LayoutGrid,
    match: (p: string) => p === "/garcom" || (p.startsWith("/garcom/mesa") && !p.endsWith("/conta")),
  },
  { href: "/garcom/pedidos", label: "Pedidos", icon: ClipboardList, match: (p: string) => p.startsWith("/garcom/pedidos") },
  { href: "/garcom/conta", label: "Conta", icon: Receipt, match: (p: string) => p.startsWith("/garcom/conta") || p.endsWith("/conta") },
  { href: "/garcom/perfil", label: "Perfil", icon: UserRound, match: (p: string) => p.startsWith("/garcom/perfil") },
]

/** Navegação inferior do garçom: ícone + rótulo, alvos grandes */
export function WaiterNav() {
  const pathname = usePathname()
  // a tela de pedido usa a altura toda (tem a própria barra inferior)
  if (pathname.endsWith("/pedido")) return null
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/85"
    >
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-18 flex-col items-center justify-center gap-1 text-sm font-semibold transition-colors outline-none focus-visible:bg-muted",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("rounded-full px-5 py-1 transition-colors", active && "bg-primary/10")}>
                  <Icon className="size-6" aria-hidden strokeWidth={active ? 2.5 : 2} />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
