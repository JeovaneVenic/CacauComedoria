import { LogoFull, LogoMark } from "@/components/brand/logo"
import { RESTAURANT_NAME } from "@/lib/brand"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r bg-muted p-12 text-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-11" />
          <span className="text-lg font-bold tracking-tight">{RESTAURANT_NAME}</span>
        </div>
        <div className="flex items-center gap-10">
          <div className="shrink-0 rounded-2xl border bg-card p-5">
            <LogoFull className="w-44 xl:w-52" priority />
          </div>
          <div className="max-w-sm">
            <p className="text-4xl leading-tight font-bold tracking-tight text-balance">Mesas, pedidos e cozinha no mesmo ritmo.</p>
            <p className="mt-4 text-base text-muted-foreground">
              O garçom lança, a cozinha recebe na hora e a gestão acompanha tudo em tempo real.
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-3 text-sm" aria-label="Módulos">
          {["Mesas", "Cozinha", "Financeiro"].map((item) => (
            <li key={item} className="rounded-xl border bg-card px-4 py-3 font-medium">
              {item}
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex items-center justify-center bg-card px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  )
}
